import "server-only";
import { db } from "../db";
import { env, features } from "../env";
import { findInstruments, popularInstruments } from "../instruments";
import { isMarketOpen, previousSessionClose } from "@/domain/market/hours";
import { simulatedHistory, simulatedQuote, simulatedYearRange } from "@/domain/market/simulated";
import type { InstrumentDef } from "@/domain/market/universe";
import { rangeStartMs, type ChartRange, type PricePoint, type Quote } from "@/domain/market/types";
import {
  CandlesNotIncluded,
  fetchCandles,
  fetchMetrics,
  fetchQuote,
  type FundamentalMetrics,
  type Priority,
} from "./finnhub";
import { fetchTimeSeries, type HistoryInterval } from "./twelvedata";

/**
 * Market data: real prices only.
 *
 * Quotes come from Finnhub through a two-tier cache (in-memory → Postgres
 * QuoteCache → API). If a fresh price can't be had, callers get the last
 * real price we saw, or nothing ("price unavailable"), never an invented one.
 *
 * Every real price we observe is also written to PriceSample, which is where
 * chart history comes from (Finnhub's free plan has no historical candles).
 *
 * For local development and automated tests only, FAKE_MARKET_DATA=1 swaps in
 * a deterministic fake market; production refuses it.
 */

export class UnknownSymbolError extends Error {
  constructor(symbol: string) {
    super(`Unknown symbol ${symbol}`);
  }
}

export class PriceUnavailableError extends Error {
  constructor(symbol: string) {
    super(`No price available for ${symbol} right now`);
  }
}

type Mode = "finnhub" | "fake" | "none";

function mode(): Mode {
  if (env().FINNHUB_API_KEY) return "finnhub";
  return features().fakeMarketData ? "fake" : "none";
}

/** True when prices are real (used by the UI and the order safety check). */
export function usesRealQuotes() {
  return mode() === "finnhub";
}

export function usesFakeQuotes() {
  return mode() === "fake";
}

async function requireInstruments(symbols: string[]): Promise<Map<string, InstrumentDef>> {
  const defs = await findInstruments(symbols);
  for (const s of symbols) if (!defs.has(s)) throw new UnknownSymbolError(s);
  return defs;
}

// ── recorded history ─────────────────────────────────────────────────────

/** Store a real quote: the latest trade price and the previous session's close. */
async function recordSamples(quotes: Quote[]) {
  const rows = quotes.flatMap((q) => {
    const out = [{ symbol: q.symbol, takenAt: q.asOf, priceCents: q.priceCents }];
    if (q.prevCloseCents > 0) {
      out.push({ symbol: q.symbol, takenAt: previousSessionClose(q.asOf), priceCents: q.prevCloseCents });
    }
    return out;
  });
  if (rows.length) await db.priceSample.createMany({ data: rows, skipDuplicates: true });
}

// ── live quote cache ──────────────────────────────────────────────────────

const memory = new Map<string, Quote & { cachedAt: number }>();

function ttlMs(now: Date) {
  // 60s keeps the free tier (60 calls/min) viable; prices don't move while
  // the market is closed, so cache much longer then.
  return isMarketOpen(now) ? 60_000 : 10 * 60_000;
}

async function liveQuotes(
  symbols: string[],
  now: Date,
  maxFetch: number,
  priority: Priority,
): Promise<Map<string, Quote>> {
  const key = env().FINNHUB_API_KEY!;
  const ttl = ttlMs(now);
  const out = new Map<string, Quote>();

  // 1. in-memory
  let missing = symbols.filter((s) => {
    const hit = memory.get(s);
    if (hit && now.getTime() - hit.cachedAt < ttl) {
      out.set(s, hit);
      return false;
    }
    return true;
  });
  if (!missing.length) return out;

  // 2. Postgres (shared across serverless instances)
  const rows = await db.quoteCache.findMany({ where: { symbol: { in: missing } } });
  const stale = new Map<string, Quote>();
  for (const row of rows) {
    const q: Quote = {
      symbol: row.symbol,
      priceCents: row.priceCents,
      prevCloseCents: row.prevCloseCents,
      openCents: null,
      highCents: null,
      lowCents: null,
      asOf: row.fetchedAt,
      source: "cache",
    };
    if (now.getTime() - row.fetchedAt.getTime() < ttl) {
      out.set(row.symbol, q);
      memory.set(row.symbol, { ...q, cachedAt: row.fetchedAt.getTime() });
    } else {
      stale.set(row.symbol, q);
    }
  }
  missing = missing.filter((s) => !out.has(s));

  // 3. Finnhub, bounded per request to respect the free-tier rate limit
  const toFetch = missing.slice(0, maxFetch);
  const fetched = await Promise.allSettled(toFetch.map((s) => fetchQuote(s, key, priority)));
  const fresh: Quote[] = [];
  fetched.forEach((result, i) => {
    const symbol = toFetch[i]!;
    if (result.status === "fulfilled") {
      out.set(symbol, result.value);
      memory.set(symbol, { ...result.value, cachedAt: now.getTime() });
      fresh.push(result.value);
    } else {
      console.warn(`[market] ${symbol}: ${String(result.reason)}`);
    }
  });
  await Promise.allSettled([
    ...fresh.map((q) => {
      const data = { priceCents: q.priceCents, prevCloseCents: q.prevCloseCents, fetchedAt: now };
      return db.quoteCache.upsert({ where: { symbol: q.symbol }, update: data, create: { symbol: q.symbol, ...data } });
    }),
    recordSamples(fresh),
  ]);

  // 4. fallback: the last real price we saw (never an invented one)
  for (const symbol of missing) {
    const last = stale.get(symbol);
    if (!out.has(symbol) && last) out.set(symbol, last);
  }
  return out;
}

// ── public API ────────────────────────────────────────────────────────────

/**
 * Quotes for many symbols. Symbols with no real price available are simply
 * absent from the result. Bulk callers refresh a few stale symbols per
 * request; the rest are served from cache and catch up on the next request.
 */
export async function getQuotes(
  symbols: string[],
  opts: { now?: Date; maxFetch?: number; priority?: Priority } = {},
): Promise<Map<string, Quote>> {
  const now = opts.now ?? new Date();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const defs = await requireInstruments(unique);
  switch (mode()) {
    case "finnhub":
      return liveQuotes(unique, now, opts.maxFetch ?? 10, opts.priority ?? "bulk");
    case "fake":
      return new Map(unique.map((s) => [s, simulatedQuote(defs.get(s)!, "NYSE", now)]));
    case "none":
      return new Map();
  }
}

/** One symbol at high priority: the stock page and order execution use this. */
export async function getQuote(symbol: string, now = new Date()): Promise<Quote> {
  const s = symbol.toUpperCase();
  const quote = (await getQuotes([s], { now, maxFetch: 1, priority: "high" })).get(s);
  if (!quote) throw new PriceUnavailableError(s);
  return quote;
}

/** Quotes for the hand-picked popular list shown on the Markets page. */
export async function getPopularQuotes(now = new Date(), maxFetch?: number) {
  const popular = await popularInstruments();
  return getQuotes(
    popular.map((i) => i.symbol),
    { now, maxFetch },
  );
}

// ── history ───────────────────────────────────────────────────────────────

export type HistorySource = "candles" | "recorded" | "fake";
export type History = {
  points: PricePoint[];
  source: HistorySource;
  /** earliest real price we hold for this symbol */
  since: number | null;
};

const CANDLE_RESOLUTION: Record<ChartRange, string> = {
  "1D": "5",
  "1W": "30",
  "1M": "60",
  "3M": "D",
  "6M": "D",
  YTD: "D",
  "1Y": "D",
  "5Y": "W",
};

// Free Finnhub keys can't read candles; remember that instead of asking again.
let candlesBlockedUntil = 0;
const candleCache = new Map<string, { at: number; points: PricePoint[] }>();

async function candleHistory(symbol: string, range: ChartRange, now: Date): Promise<PricePoint[] | null> {
  if (Date.now() < candlesBlockedUntil) return null;
  const cacheKey = `${symbol}:${range}`;
  const ttl = range === "1D" ? 5 * 60_000 : 60 * 60_000;
  const hit = candleCache.get(cacheKey);
  if (hit && now.getTime() - hit.at < ttl) return hit.points;
  try {
    const points = await fetchCandles(
      symbol,
      CANDLE_RESOLUTION[range],
      Math.floor(rangeStartMs(range, now.getTime()) / 1000),
      Math.floor(now.getTime() / 1000),
      env().FINNHUB_API_KEY!,
    );
    candleCache.set(cacheKey, { at: now.getTime(), points });
    return points;
  } catch (err) {
    if (err instanceof CandlesNotIncluded) candlesBlockedUntil = Date.now() + 24 * 3_600_000;
    return null;
  }
}

// ── history backfill (Twelve Data) ──────────────────────────────────────

const BACKFILL_SIZE: Record<HistoryInterval, number> = {
  "1day": 1_300, // ~5 years of sessions
  "5min": 600, // ~7 sessions: covers 1D and 1W
};
const inflight = new Map<string, Promise<void>>();

function backfillStaleAfterMs(interval: HistoryInterval, now: Date) {
  if (interval === "1day") return 12 * 3_600_000;
  return isMarketOpen(now) ? 5 * 60_000 : 60 * 60_000;
}

/**
 * Downloads real history for a symbol once, then tops it up when stale, into
 * the same PriceSample table live quotes are recorded in. Needs
 * TWELVE_DATA_API_KEY; failures just leave the recorded history as it is.
 */
async function ensureBackfill(symbol: string, interval: HistoryInterval, now: Date) {
  const key = env().TWELVE_DATA_API_KEY;
  if (!key) return;
  const id = `${symbol}:${interval}`;
  const running = inflight.get(id);
  if (running) return running;

  const job = (async () => {
    const mark = await db.historyBackfill.findUnique({
      where: { symbol_resolution: { symbol, resolution: interval } },
    });
    if (mark && now.getTime() - mark.fetchedAt.getTime() < backfillStaleAfterMs(interval, now)) return;
    // First time: full history. Afterwards: just the gap since the last fetch.
    const size = mark
      ? Math.min(
          BACKFILL_SIZE[interval],
          Math.ceil((now.getTime() - mark.fetchedAt.getTime()) / (interval === "1day" ? 86_400_000 : 5 * 60_000)) + 5,
        )
      : BACKFILL_SIZE[interval];
    // Only store finished bars: today's daily bar (stamped at 4pm) and the
    // current 5-minute bar are still moving and would be stored stale.
    const barMs = interval === "1day" ? 0 : 5 * 60_000;
    const points = (await fetchTimeSeries(symbol, interval, size, key)).filter((pt) => pt.t + barMs <= now.getTime());
    if (points.length) {
      await db.priceSample.createMany({
        data: points.map((pt) => ({ symbol, takenAt: new Date(pt.t), priceCents: pt.p })),
        skipDuplicates: true,
      });
    }
    await db.historyBackfill.upsert({
      where: { symbol_resolution: { symbol, resolution: interval } },
      create: { symbol, resolution: interval, fetchedAt: now },
      update: { fetchedAt: now },
    });
  })()
    .catch((err) => console.warn(`[history] ${symbol} ${interval}: ${String(err)}`))
    .finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}

/** Real prices we've recorded, thinned to one point per day for long ranges. */
async function recordedHistory(symbol: string, range: ChartRange, now: Date): Promise<History> {
  const from = new Date(rangeStartMs(range, now.getTime()));
  const intraday = range === "1D" || range === "1W";
  const [rows, first] = await Promise.all([
    intraday
      ? db.priceSample.findMany({
          where: { symbol, takenAt: { gte: from, lte: now } },
          orderBy: { takenAt: "asc" },
          take: 2_000,
          select: { takenAt: true, priceCents: true },
        })
      : db.$queryRaw<{ takenAt: Date; priceCents: number }[]>`
          SELECT DISTINCT ON (date_trunc('day', "takenAt")) "takenAt", "priceCents"
          FROM "PriceSample"
          WHERE symbol = ${symbol} AND "takenAt" >= ${from} AND "takenAt" <= ${now}
          ORDER BY date_trunc('day', "takenAt"), "takenAt" DESC`,
    db.priceSample.findFirst({ where: { symbol }, orderBy: { takenAt: "asc" }, select: { takenAt: true } }),
  ]);
  const points = rows.map((r) => ({ t: r.takenAt.getTime(), p: r.priceCents })).sort((a, b) => a.t - b.t);
  return { points, source: "recorded", since: first?.takenAt.getTime() ?? null };
}

/**
 * Chart history: Finnhub candles when the key's plan includes them, otherwise
 * the real prices Bullpen has recorded. The current quote (if given) is
 * appended so the line always ends at the live price.
 */
export async function getHistory(
  symbol: string,
  range: ChartRange,
  now = new Date(),
  current?: Quote,
): Promise<History> {
  const s = symbol.toUpperCase();
  const def = (await requireInstruments([s])).get(s)!;

  if (mode() === "fake") {
    return { points: simulatedHistory(def, "NYSE", range, now), source: "fake", since: null };
  }
  if (mode() === "none") return { points: [], source: "recorded", since: null };

  await ensureBackfill(s, range === "1D" || range === "1W" ? "5min" : "1day", now);
  const candles = env().TWELVE_DATA_API_KEY ? null : await candleHistory(s, range, now);
  const history: History =
    candles && candles.length > 1
      ? { points: candles, source: "candles", since: candles[0]!.t }
      : await recordedHistory(s, range, now);

  if (current) {
    const last = history.points[history.points.length - 1];
    if (!last || last.t < current.asOf.getTime()) {
      history.points.push({ t: current.asOf.getTime(), p: current.priceCents });
    }
  }
  return history;
}

/** Daily job: record closing prices for the popular list and everything held. */
export async function recordDailyCloses(now = new Date()) {
  const [held, popular] = await Promise.all([
    db.holding.findMany({ distinct: ["symbol"], select: { symbol: true } }),
    popularInstruments(),
  ]);
  const symbols = [...new Set([...popular.map((p) => p.symbol), ...held.map((h) => h.symbol)])];
  const quotes = await getQuotes(symbols, { now, maxFetch: 45, priority: "high" });
  return { symbols: symbols.length, priced: quotes.size };
}

// ── key stats ─────────────────────────────────────────────────────────────

export type KeyStats = {
  openCents: number | null;
  highCents: number | null;
  lowCents: number | null;
  prevCloseCents: number;
  yearHighCents: number | null;
  yearLowCents: number | null;
  marketCapDollars: number | null;
  peRatio: number | null;
  beta: number | null;
  dividendYieldPct: number | null;
};

const NO_METRICS = {
  yearHighCents: null,
  yearLowCents: null,
  marketCapDollars: null,
  peRatio: null,
  beta: null,
  dividendYieldPct: null,
};

const metricsCache = new Map<string, { value: FundamentalMetrics; at: number }>();

export async function getKeyStats(quote: Quote, now = new Date()): Promise<KeyStats> {
  const base = {
    openCents: quote.openCents,
    highCents: quote.highCents,
    lowCents: quote.lowCents,
    prevCloseCents: quote.prevCloseCents,
  };

  if (mode() === "fake") {
    const def = (await requireInstruments([quote.symbol])).get(quote.symbol)!;
    const year = simulatedYearRange(def, "NYSE", now);
    return { ...base, ...NO_METRICS, yearHighCents: year.highCents, yearLowCents: year.lowCents };
  }
  if (mode() !== "finnhub") return { ...base, ...NO_METRICS };

  let metrics = metricsCache.get(quote.symbol);
  if (!metrics || now.getTime() - metrics.at > 24 * 3_600_000) {
    try {
      metrics = { value: await fetchMetrics(quote.symbol, env().FINNHUB_API_KEY!), at: now.getTime() };
      metricsCache.set(quote.symbol, metrics);
    } catch (err) {
      console.warn(`[market] metrics ${quote.symbol}: ${String(err)}`);
    }
  }
  return metrics ? { ...base, ...metrics.value } : { ...base, ...NO_METRICS };
}

/** Last day of recorded real prices for many symbols in one query (Markets page sparklines). */
export async function getSparklines(symbols: string[], now = new Date(), points = 40): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!symbols.length) return out;
  if (mode() === "fake") {
    const defs = await requireInstruments(symbols);
    for (const [s, def] of defs)
      out.set(
        s,
        downsample(simulatedHistory(def, "NYSE", "1D", now), points).map((p) => p.p),
      );
    return out;
  }
  const rows = await db.priceSample.findMany({
    where: { symbol: { in: symbols }, takenAt: { gte: new Date(rangeStartMs("1D", now.getTime())), lte: now } },
    orderBy: { takenAt: "asc" },
    select: { symbol: true, takenAt: true, priceCents: true },
  });
  const grouped = new Map<string, PricePoint[]>();
  for (const r of rows) {
    const list = grouped.get(r.symbol) ?? [];
    list.push({ t: r.takenAt.getTime(), p: r.priceCents });
    grouped.set(r.symbol, list);
  }
  for (const [s, list] of grouped)
    out.set(
      s,
      downsample(list, points).map((p) => p.p),
    );
  return out;
}

function downsample<T>(items: T[], target: number): T[] {
  if (items.length <= target) return items;
  const step = (items.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => items[Math.round(i * step)]!);
}
