import "server-only";
import { db } from "./db";
import { getQuotes, usesRealQuotes } from "./market";
import { getPortfolioDetail, getPortfolioHistory, getStartOfDayValue, valuePortfolioNow } from "./portfolio";
import { getInstrument } from "@/domain/market/universe";
import { marketStatus } from "@/domain/market/status";
import { sectorAllocation } from "@/domain/portfolio";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";

/** Everything the portfolio overview component needs, in one call. */
export async function loadPortfolioOverview(portfolioId: string, now = new Date()) {
  const p = await getPortfolioDetail(portfolioId);
  const symbols = p.holdings.map((h) => h.symbol);
  const [quotes, valuation, history] = await Promise.all([
    symbols.length ? getQuotes(symbols, p.league.marketSource, { now }) : Promise.resolve(new Map()),
    valuePortfolioNow(p, now),
    getPortfolioHistory(p.id, "1D", now),
  ]);
  const startOfDayCents = await getStartOfDayValue(p.id, valuation.totalValueCents, now);

  return {
    detail: p,
    valuation,
    allocation: sectorAllocation(valuation.positions, (s) => getInstrument(s)?.sector ?? "Other"),
    props: {
      portfolioId: p.id,
      leagueName: p.league.name,
      source: p.league.marketSource,
      startingCashCents: p.league.startingCashCents,
      cashCents: p.cashCents,
      realizedPnlCents: p.realizedPnlCents,
      feesPaidCents: p.feesPaidCents,
      holdings: p.holdings.map((h) => ({
        symbol: h.symbol,
        quantity: h.quantity,
        costBasisCents: h.costBasisCents,
        name: getInstrument(h.symbol)?.name ?? h.symbol,
      })),
      initialQuotes: [...quotes.values()].map(serializeQuote),
      startOfDayCents,
      initialPoints: history,
      status: serializeStatus(marketStatus(p.league.marketSource, now)),
      realQuotes: usesRealQuotes(p.league.marketSource),
    },
  };
}

export async function recentTrades(portfolioId: string, take = 25) {
  return db.trade.findMany({ where: { portfolioId }, orderBy: { executedAt: "desc" }, take });
}
