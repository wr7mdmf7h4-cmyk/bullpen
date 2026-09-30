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

// Stay safely under the 60/min free-tier limit, per server instance.
const CALLS_PER_MINUTE = 50;
let windowStart = 0;
let callsInWindow = 0;

function takeToken(): boolean {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    callsInWindow = 0;
  }
  if (callsInWindow >= CALLS_PER_MINUTE) return false;
  callsInWindow += 1;
  return true;
}

export class FinnhubUnavailable extends Error {}

async function get(path: string, apiKey: string): Promise<unknown> {
  if (!takeToken()) throw new FinnhubUnavailable("local Finnhub budget exhausted");
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Finnhub-Token": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
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
const toCents = (dollars: number | null | undefined) =>
  dollars && dollars > 0 ? Math.round(dollars * 100) : null;

export async function fetchQuote(symbol: string, apiKey: string): Promise<Quote> {
  const data = quoteSchema.parse(await get(`/quote?symbol=${encodeURIComponent(symbol)}`, apiKey));
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
  const { metric } = metricSchema.parse(await get(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`, apiKey));
  return {
    yearHighCents: toCents(metric["52WeekHigh"]),
    yearLowCents: toCents(metric["52WeekLow"]),
    marketCapDollars: metric.marketCapitalization ? Math.round(metric.marketCapitalization * 1_000_000) : null,
    peRatio: metric.peTTM ?? null,
    beta: metric.beta ?? null,
    dividendYieldPct: metric.dividendYieldIndicatedAnnual ?? null,
  };
}
