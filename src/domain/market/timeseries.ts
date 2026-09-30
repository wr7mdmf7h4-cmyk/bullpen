import { nyTimeToUtc, sessionOn } from "./hours";
import type { PricePoint } from "./types";

export type TimeSeriesValue = { datetime: string; close: string };

/**
 * Converts a provider time series (New York wall-clock datetimes, decimal
 * close prices as strings) into ascending points in integer cents.
 *
 * - daily bars ("2026-09-29") are stamped at that session's close (4pm ET,
 *   or 1pm on early-close days)
 * - intraday bars ("2026-09-30 15:55:00") at their NY time, converted to UTC
 */
export function parseTimeSeries(values: TimeSeriesValue[]): PricePoint[] {
  const out: PricePoint[] = [];
  for (const v of values) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(v.datetime);
    const price = Number(v.close);
    if (!m || !Number.isFinite(price) || price <= 0) continue;
    const day = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    const t =
      m[4] !== undefined
        ? nyTimeToUtc(day, Number(m[4]) * 60 + Number(m[5]))
        : (sessionOn(day)?.close ?? nyTimeToUtc(day, 16 * 60));
    out.push({ t: t.getTime(), p: Math.round(price * 100) });
  }
  return out.sort((a, b) => a.t - b.t);
}
