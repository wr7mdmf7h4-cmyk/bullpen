import { ratioBps, type Bps, type Cents } from "./money";
import { averageCostCents } from "./trading";

export type HoldingInput = { symbol: string; quantity: number; costBasisCents: Cents };

export type ValuedPosition = HoldingInput & {
  priceCents: Cents;
  marketValueCents: Cents;
  averageCostCents: Cents;
  unrealizedPnlCents: Cents;
  unrealizedPnlBps: Bps;
  /** share of total portfolio value, in bps */
  weightBps: Bps;
};

export type PortfolioValuation = {
  cashCents: Cents;
  holdingsValueCents: Cents;
  totalValueCents: Cents;
  costBasisCents: Cents;
  unrealizedPnlCents: Cents;
  /** total value vs starting cash */
  totalReturnCents: Cents;
  totalReturnBps: Bps;
  positions: ValuedPosition[];
};

/**
 * Values a portfolio at the given prices. Used on the server (leaderboards,
 * snapshots) and in the browser (live-updating portfolio page) alike.
 * Missing prices fall back to average cost so a data outage never shows a
 * position as worthless.
 */
export function valuePortfolio(
  cashCents: Cents,
  holdings: HoldingInput[],
  prices: ReadonlyMap<string, Cents> | Record<string, Cents>,
  startingCashCents: Cents,
): PortfolioValuation {
  const priceOf = (s: string) => (prices instanceof Map ? prices.get(s) : (prices as Record<string, Cents>)[s]);

  const partial = holdings.map((h) => {
    const avg = averageCostCents(h);
    const priceCents = priceOf(h.symbol) ?? avg;
    const marketValueCents = priceCents * h.quantity;
    return {
      ...h,
      priceCents,
      marketValueCents,
      averageCostCents: avg,
      unrealizedPnlCents: marketValueCents - h.costBasisCents,
      unrealizedPnlBps: ratioBps(marketValueCents - h.costBasisCents, h.costBasisCents),
    };
  });

  const holdingsValueCents = partial.reduce((sum, p) => sum + p.marketValueCents, 0);
  const costBasisCents = partial.reduce((sum, p) => sum + p.costBasisCents, 0);
  const totalValueCents = cashCents + holdingsValueCents;
  const positions = partial
    .map((p) => ({ ...p, weightBps: ratioBps(p.marketValueCents, totalValueCents) }))
    .sort((a, b) => b.marketValueCents - a.marketValueCents);

  return {
    cashCents,
    holdingsValueCents,
    totalValueCents,
    costBasisCents,
    unrealizedPnlCents: holdingsValueCents - costBasisCents,
    totalReturnCents: totalValueCents - startingCashCents,
    totalReturnBps: ratioBps(totalValueCents - startingCashCents, startingCashCents),
    positions,
  };
}

/** Allocation by sector (bps of holdings value), largest first. */
export function sectorAllocation(
  positions: Pick<ValuedPosition, "symbol" | "marketValueCents">[],
  sectorOf: (symbol: string) => string,
): { sector: string; valueCents: Cents; bps: Bps }[] {
  const totals = new Map<string, Cents>();
  for (const p of positions) totals.set(sectorOf(p.symbol), (totals.get(sectorOf(p.symbol)) ?? 0) + p.marketValueCents);
  const all = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([sector, valueCents]) => ({ sector, valueCents, bps: ratioBps(valueCents, all) }))
    .sort((a, b) => b.valueCents - a.valueCents);
}
