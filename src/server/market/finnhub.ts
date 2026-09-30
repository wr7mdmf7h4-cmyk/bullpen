import "server-only";
import { z } from "zod";
import type { Quote } from "@/domain/market/types";

/**
 * Minimal Finnhub client (free tier: 60 calls/min). Only the endpoints that
 * are available on the free plan are used: /quote and /stock/metric.
 * Historical candles are premium, so charts use an anchored simulation.
 */

const BASE = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 4_000;

/**
 * Call budget, per server instance, inside the free tier's 60 calls/min:
 * - "high" priority (the stock you're looking at, the order you're placing)
 *   may use the whole budget;
 * - "bulk" refreshes (lists, leaderboards, background enrichment) stop at a
 *   lower ceiling so they can never starve a trade of a fresh price.
 * After a 429 we back off entirely for a short cooldown.
 */
export type Priority = "high" | "bulk";

const LIMITS: Record<Priority, number> = { high: 50, bulk: 30 };
const COOLDOWN_MS = 30_000;
let windowStart = 0;
let callsInWindow = 0;
let cooldownUntil = 0;

function takeToken(priority: Priority): boolean {
  const now = Date.now();
  if (now < cooldownUntil) return false;
  if (now - windowStart >= 60_000) {
    windowStart = now;
    callsInWindow = 0;
  }
  if (callsInWindow >= LIMITS[priority]) return false;
  callsInWindow += 1;
  return true;
}

export class FinnhubUnavailable extends Error {}

async function get(path: string, apiKey: string, priority: Priority): Promise<unknown> {
  if (!takeToken(priority)) throw new FinnhubUnavailable(`local Finnhub budget exhausted (${priority})`);
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Finnhub-Token": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 429) cooldownUntil = Date.now() + COOLDOWN_MS;
  if (!res.ok) throw new FinnhubUnavailable(`Finnhub ${path} → HTTP ${res.status}`);
  return res.json();
}

const quoteSchema = z.object({
  c: z.number(), // current
  pc: z.number(), // previous close
  o: z.number().nullable().optional(),
  h: z.number().nullable().optional(),
  l: z.number().nullable().optional(),
  t: z.number(), // unix seconds
});

/** Dollars (float from the wire) → integer cents, exactly once, at the boundary. */
const toCents = (dollars: number | null | undefined) => (dollars && dollars > 0 ? Math.round(dollars * 100) : null);

export async function fetchQuote(symbol: string, apiKey: string, priority: Priority): Promise<Quote> {
  const data = quoteSchema.parse(await get(`/quote?symbol=${encodeURIComponent(symbol)}`, apiKey, priority));
  const price = toCents(data.c);
  const prev = toCents(data.pc);
  if (!price || !prev) throw new FinnhubUnavailable(`No quote for ${symbol}`);
  return {
    symbol,
    priceCents: price,
    prevCloseCents: prev,
    openCents: toCents(data.o),
    highCents: toCents(data.h),
    lowCents: toCents(data.l),
    asOf: new Date(data.t * 1000),
    source: "finnhub",
  };
}

const metricSchema = z.object({
  metric: z
    .object({
      "52WeekHigh": z.number().nullable().optional(),
      "52WeekLow": z.number().nullable().optional(),
      marketCapitalization: z.number().nullable().optional(),
      peTTM: z.number().nullable().optional(),
      beta: z.number().nullable().optional(),
      dividendYieldIndicatedAnnual: z.number().nullable().optional(),
    })
    .partial()
    .default({}),
});

export type FundamentalMetrics = {
  yearHighCents: number | null;
  yearLowCents: number | null;
  /** in whole dollars */
  marketCapDollars: number | null;
  peRatio: number | null;
  beta: number | null;
  dividendYieldPct: number | null;
};

export async function fetchMetrics(symbol: string, apiKey: string): Promise<FundamentalMetrics> {
  const { metric } = metricSchema.parse(
    await get(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`, apiKey, "bulk"),
  );
  return {
    yearHighCents: toCents(metric["52WeekHigh"]),
    yearLowCents: toCents(metric["52WeekLow"]),
    marketCapDollars: metric.marketCapitalization ? Math.round(metric.marketCapitalization * 1_000_000) : null,
    peRatio: metric.peTTM ?? null,
    beta: metric.beta ?? null,
    dividendYieldPct: metric.dividendYieldIndicatedAnnual ?? null,
  };
}

const profileSchema = z.object({ finnhubIndustry: z.string().nullable(), name: z.string().nullable() }).partial();

/** Company profile; used to classify a stock's sector the first time it's viewed. */
export async function fetchProfile(
  symbol: string,
  apiKey: string,
): Promise<{ industry: string | null; name: string | null }> {
  const p = profileSchema.parse(await get(`/stock/profile2?symbol=${encodeURIComponent(symbol)}`, apiKey, "bulk"));
  return { industry: p.finnhubIndustry ?? null, name: p.name ?? null };
}
