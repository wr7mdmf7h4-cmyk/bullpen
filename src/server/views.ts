import "server-only";
import { db } from "./db";
import { findInstruments } from "./instruments";
import { getQuotes } from "./market";
import {
  getPortfolioDetail,
  getPortfolioHistory,
  getStartOfDayValue,
  maybeRecordSnapshot,
  valuePortfolioNow,
} from "./portfolio";
import { marketStatus } from "@/domain/market/status";
import { sectorAllocation } from "@/domain/portfolio";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";

/** Everything the portfolio overview component needs, in one call. */
export async function loadPortfolioOverview(portfolioId: string, now = new Date()) {
  // Viewing the portfolio records a real value point (at most every 15 min).
  await maybeRecordSnapshot(portfolioId, now).catch((e) => console.error("[views] snapshot failed", e));

  const p = await getPortfolioDetail(portfolioId);
  const symbols = p.holdings.map((h) => h.symbol);
  const [quotes, valuation, history, instruments] = await Promise.all([
    symbols.length ? getQuotes(symbols, { now }) : Promise.resolve(new Map()),
    valuePortfolioNow(p, now),
    getPortfolioHistory(p.id, "1D", now),
    findInstruments(symbols),
  ]);
  const startOfDayCents = await getStartOfDayValue(p.id, valuation.totalValueCents, now);

  return {
    detail: p,
    valuation,
    allocation: sectorAllocation(valuation.positions, (s) => {
      const sector = instruments.get(s)?.sector;
      return !sector || sector === "Unknown" ? "Other" : sector;
    }),
    props: {
      portfolioId: p.id,
      leagueName: p.league.name,
      startingCashCents: p.league.startingCashCents,
      cashCents: p.cashCents,
      realizedPnlCents: p.realizedPnlCents,
      feesPaidCents: p.feesPaidCents,
      holdings: p.holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        costBasisCents: h.costBasisCents,
        name: instruments.get(h.symbol)?.name ?? h.symbol,
      })),
      initialQuotes: [...quotes.values()].map(serializeQuote),
      startOfDayCents,
      initialPoints: history,
      status: serializeStatus(marketStatus(now)),
    },
  };
}

export async function recentTrades(portfolioId: string, take = 25) {
  return db.trade.findMany({ where: { portfolioId }, orderBy: { executedAt: "desc" }, take });
}
