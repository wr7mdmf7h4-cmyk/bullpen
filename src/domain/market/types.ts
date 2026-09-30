import { ratioBps } from "../money";

export type QuoteSource = "finnhub" | "cache" | "simulated";

export type Quote = {
  symbol: string;
  priceCents: number;
  prevCloseCents: number;
  openCents: number | null;
  highCents: number | null;
  lowCents: number | null;
  asOf: Date;
  source: QuoteSource;
};

export const CHART_RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const DAY_MS = 86_400_000;

/**
 * Start of a chart range ending at `end` (ms). YTD starts at 1 January of
 * `end`'s year (UTC); everything else is a fixed lookback.
 */
export function rangeStartMs(range: ChartRange, end: number): number {
  switch (range) {
    case "1D":
      return end - DAY_MS;
    case "1W":
      return end - 7 * DAY_MS;
    case "1M":
      return end - 30 * DAY_MS;
    case "3M":
      return end - 91 * DAY_MS;
    case "6M":
      return end - 182 * DAY_MS;
    case "YTD":
      return Date.UTC(new Date(end).getUTCFullYear(), 0, 1);
    case "1Y":
      return end - 365 * DAY_MS;
    case "5Y":
      return end - (5 * 365 + 1) * DAY_MS;
  }
}

/** t = ms since epoch, p = price in cents */
export type PricePoint = { t: number; p: number };

export function changeCents(q: Pick<Quote, "priceCents" | "prevCloseCents">): number {
  return q.priceCents - q.prevCloseCents;
}

/** Change vs previous close in basis points. */
export function changeBps(q: Pick<Quote, "priceCents" | "prevCloseCents">): number {
  return ratioBps(q.priceCents - q.prevCloseCents, q.prevCloseCents);
}
