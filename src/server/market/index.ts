import "server-only";
import { db } from "../db";
import { env } from "../env";
import { getInstrument, UNIVERSE, type InstrumentDef } from "@/domain/market/universe";
import { simulatedHistory, simulatedPriceCents, simulatedQuote, simulatedYearRange } from "@/domain/market/simulated";
import { calendarFor } from "@/domain/market/status";
import { isMarketOpen } from "@/domain/market/hours";
import type { ChartRange, PricePoint, Quote } from "@/domain/market/types";
import type { MarketSourceKind } from "@/domain/leagues";
import { fetchMetrics, fetchQuote, type FundamentalMetrics } from "./finnhub";

/**
 * Market data facade. Callers ask for quotes "for a league's market source";
 * this module decides where they come from:
 *
 *   SIMULATED league           → deterministic simulation, always open
 *   LIVE league, no API key    → simulation on the real NYSE calendar
 *   LIVE league, FINNHUB key   → Finnhub, through a two-tier cache
 *                                (in-memory → Postgres QuoteCache → API),
 *                                falling back to the last known price and
 *                                finally to the simulation if the API fails.
 */

export class UnknownSymbolError extends Error {
  constructor(symbol: string) {
    super(`Unknown symbol ${symbol}`);
  }
}

function requireInstrument(symbol: string): InstrumentDef {
  const def = getInstrument(symbol);
  if (!def) throw new UnknownSymbolError(symbol);
  return def;
}

function liveKey() {
  return env().FINNHUB_API_KEY;
}

export function usesRealQuotes(source: MarketSourceKind) {
  return source === "LIVE" && Boolean(liveKey());
}

// ── live quote cache ──────────────────────────────────────────────────────

const memory = new Map<string, Quote & { cachedAt: number }>();

function ttlMs(now: Date) {
  // Prices don't move while the market is closed, so cache much longer.
  return isMarketOpen(now) ? 15_000 : 10 * 60_000;
}

async function liveQuotes(symbols: string[], now: Date, maxFetch: number): Promise<Map<string, Quote>> {
  const key = liveKey()!;
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
  const fetched = await Promise.allSettled(toFetch.map((s) => fetchQuote(s, key)));
  const writes: Promise<unknown>[] = [];
  fetched.forEach((result, i) => {
    const symbol = toFetch[i]!;
    if (result.status === "fulfilled") {
      const q = result.value;
      out.set(symbol, q);
      memory.set(symbol, { ...q, cachedAt: now.getTime() });
      const data = { priceCents: q.priceCents, prevCloseCents: q.prevCloseCents, fetchedAt: now };
      writes.push(db.quoteCache.upsert({ where: { symbol }, update: data, create: { symbol, ...data } }));
    } else {
      console.warn(`[market] ${symbol}: ${String(result.reason)}`);
    }
  });
  await Promise.allSettled(writes);

  // 4. fallbacks: last known price, then the simulation
  for (const symbol of missing) {
    if (out.has(symbol)) continue;
    out.set(symbol, stale.get(symbol) ?? simulatedQuote(requireInstrument(symbol), "NYSE", now));
  }
  return out;
}

// ── public API ────────────────────────────────────────────────────────────

export async function getQuotes(
  symbols: string[],
  source: MarketSourceKind,
  opts: { now?: Date; maxFetch?: number } = {},
): Promise<Map<string, Quote>> {
  const now = opts.now ?? new Date();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  unique.forEach(requireInstrument);
  if (usesRealQuotes(source)) return liveQuotes(unique, now, opts.maxFetch ?? 25);
  const calendar = calendarFor(source);
  return new Map(unique.map((s) => [s, simulatedQuote(requireInstrument(s), calendar, now)]));
}

export async function getQuote(symbol: string, source: MarketSourceKind, now = new Date()): Promise<Quote> {
  const quotes = await getQuotes([symbol], source, { now, maxFetch: 1 });
  return quotes.get(symbol.toUpperCase())!;
}

export async function getAllQuotes(source: MarketSourceKind, now = new Date()) {
  return getQuotes(
    UNIVERSE.map((i) => i.symbol),
    source,
    { now },
  );
}

export type History = { points: PricePoint[]; illustrative: boolean };

/**
 * Chart history. With real quotes the *shape* comes from the simulation (free
 * Finnhub has no candles) but is anchored so it ends exactly at the live price;
 * the UI labels these charts as illustrative.
 */
export async function getHistory(
  symbol: string,
  source: MarketSourceKind,
  range: ChartRange,
  now = new Date(),
): Promise<History> {
  const def = requireInstrument(symbol);
  const calendar = calendarFor(source);
  const points = simulatedHistory(def, calendar, range, now);
  if (!usesRealQuotes(source)) return { points, illustrative: false };

  const live = await getQuote(symbol, source, now);
  if (live.source === "simulated") return { points, illustrative: false };
  const last = points[points.length - 1]!;
  const factor = live.priceCents / simulatedPriceCents(def, last.t);
  return {
    points: points.map((pt) => ({ t: pt.t, p: Math.max(1, Math.round(pt.p * factor)) })),
    illustrative: true,
  };
}

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

const metricsCache = new Map<string, { value: FundamentalMetrics; at: number }>();

export async function getKeyStats(symbol: string, source: MarketSourceKind, now = new Date()): Promise<KeyStats> {
  const def = requireInstrument(symbol);
  const quote = await getQuote(symbol, source, now);
  const base = {
    openCents: quote.openCents,
    highCents: quote.highCents,
    lowCents: quote.lowCents,
    prevCloseCents: quote.prevCloseCents,
  };

  if (usesRealQuotes(source)) {
    let metrics = metricsCache.get(def.symbol);
    if (!metrics || now.getTime() - metrics.at > 24 * 3_600_000) {
      try {
        metrics = { value: await fetchMetrics(def.symbol, liveKey()!), at: now.getTime() };
        metricsCache.set(def.symbol, metrics);
      } catch (err) {
        console.warn(`[market] metrics ${def.symbol}: ${String(err)}`);
      }
    }
    if (metrics) return { ...base, ...metrics.value };
  }

  const year = simulatedYearRange(def, calendarFor(source), now);
  return {
    ...base,
    yearHighCents: year.highCents,
    yearLowCents: year.lowCents,
    marketCapDollars: null,
    peRatio: null,
    beta: null,
    dividendYieldPct: null,
  };
}
