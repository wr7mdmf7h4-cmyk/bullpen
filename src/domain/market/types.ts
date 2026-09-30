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

export const CHART_RANGES = ["1D", "1W", "1M", "1Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

/** t = ms since epoch, p = price in cents */
export type PricePoint = { t: number; p: number };

export function changeCents(q: Pick<Quote, "priceCents" | "prevCloseCents">): number {
  return q.priceCents - q.prevCloseCents;
}

/** Change vs previous close in basis points. */
export function changeBps(q: Pick<Quote, "priceCents" | "prevCloseCents">): number {
  return ratioBps(q.priceCents - q.prevCloseCents, q.prevCloseCents);
}
