import "server-only";
import { z } from "zod";
import { parseTimeSeries } from "@/domain/market/timeseries";
import type { PricePoint } from "@/domain/market/types";

/**
 * Minimal Twelve Data client for price history (free plan: 8 credits/minute,
 * 800/day; /time_series costs 1 credit per symbol).
 */

const BASE = "https://api.twelvedata.com";
const PER_MINUTE = 7; // stay just under the free plan's 8/min, per instance
let windowStart = 0;
let callsInWindow = 0;
let blockedUntil = 0;

export class HistoryProviderUnavailable extends Error {}

function takeToken(): boolean {
  const now = Date.now();
  if (now < blockedUntil) return false;
  if (now - windowStart >= 60_000) {
    windowStart = now;
    callsInWindow = 0;
  }
  if (callsInWindow >= PER_MINUTE) return false;
  callsInWindow += 1;
  return true;
}

const responseSchema = z.union([
  z.object({
    status: z.literal("ok"),
    values: z.array(z.object({ datetime: z.string(), close: z.string() })),
  }),
  z.object({ status: z.literal("error"), code: z.number().optional(), message: z.string().optional() }),
]);

export type HistoryInterval = "1day" | "5min";

export async function fetchTimeSeries(
  symbol: string,
  interval: HistoryInterval,
  outputsize: number,
  apiKey: string,
): Promise<PricePoint[]> {
  if (!takeToken()) throw new HistoryProviderUnavailable("history budget exhausted");
  const url =
    `${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}` +
    `&outputsize=${Math.min(5000, Math.max(1, outputsize))}&timezone=America/New_York&order=asc`;
  const res = await fetch(url, {
    headers: { Authorization: `apikey ${apiKey}` },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!res.ok) throw new HistoryProviderUnavailable(`Twelve Data HTTP ${res.status}`);
  const body = responseSchema.parse(await res.json());
  if (body.status === "error") {
    if (body.code === 429) {
      // Minute limit resets quickly; the daily allowance doesn't.
      blockedUntil = Date.now() + (/day/i.test(body.message ?? "") ? 60 * 60_000 : 60_000);
    }
    throw new HistoryProviderUnavailable(`Twelve Data ${body.code ?? ""}: ${body.message ?? "error"}`);
  }
  return parseTimeSeries(body.values);
}
