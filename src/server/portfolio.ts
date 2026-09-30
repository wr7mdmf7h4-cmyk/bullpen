import "server-only";
import { db } from "./db";
import { getHistory, getQuotes } from "./market";
import { valuePortfolio, type PortfolioValuation } from "@/domain/portfolio";
import { leagueStatus, type MarketSourceKind } from "@/domain/leagues";
import type { ChartRange, PricePoint } from "@/domain/market/types";

type PortfolioWithHoldings = {
  id: string;
  cashCents: number;
  holdings: { symbol: string; quantity: number; costBasisCents: number }[];
  league: { marketSource: MarketSourceKind; startingCashCents: number };
};

/** Values one portfolio at current prices for its league's market. */
export async function valuePortfolioNow(p: PortfolioWithHoldings, now = new Date()): Promise<PortfolioValuation> {
  const symbols = p.holdings.map((h) => h.symbol);
  const quotes = symbols.length ? await getQuotes(symbols, p.league.marketSource, { now }) : new Map();
  const prices = new Map([...quotes.values()].map((q) => [q.symbol, q.priceCents]));
  return valuePortfolio(p.cashCents, p.holdings, prices, p.league.startingCashCents);
}

/**
 * Values many portfolios with one quote lookup per market source. Used by
 * leaderboards and the daily snapshot cron.
 */
export async function valuePortfolios<T extends PortfolioWithHoldings>(
  portfolios: T[],
  now = new Date(),
): Promise<Map<string, PortfolioValuation>> {
  const bySource = new Map<MarketSourceKind, Set<string>>();
  for (const p of portfolios) {
    const set = bySource.get(p.league.marketSource) ?? new Set<string>();
    p.holdings.forEach((h) => set.add(h.symbol));
    bySource.set(p.league.marketSource, set);
  }
  const prices = new Map<MarketSourceKind, Map<string, number>>();
  for (const [source, symbols] of bySource) {
    const quotes = symbols.size ? await getQuotes([...symbols], source, { now, maxFetch: 20 }) : new Map();
    prices.set(source, new Map([...quotes.values()].map((q) => [q.symbol, q.priceCents])));
  }
  return new Map(
    portfolios.map((p) => [
      p.id,
      valuePortfolio(p.cashCents, p.holdings, prices.get(p.league.marketSource)!, p.league.startingCashCents),
    ]),
  );
}

const portfolioInclude = {
  holdings: { select: { symbol: true, quantity: true, costBasisCents: true, openedAt: true } },
  league: true,
} as const;

export async function getPortfolioDetail(portfolioId: string) {
  return db.portfolio.findUniqueOrThrow({ where: { id: portfolioId }, include: portfolioInclude });
}

/** Records the portfolio's value right now (called after every trade). */
export async function recordSnapshot(portfolioId: string, now = new Date()) {
  const p = await getPortfolioDetail(portfolioId);
  const v = await valuePortfolioNow(p, now);
  await db.portfolioSnapshot.upsert({
    where: { portfolioId_takenAt: { portfolioId, takenAt: now } },
    create: { portfolioId, takenAt: now, totalValueCents: v.totalValueCents, cashCents: v.cashCents },
    update: { totalValueCents: v.totalValueCents, cashCents: v.cashCents },
  });
  return v;
}

/** Daily cron: snapshot every portfolio in a league that is still running. */
export async function snapshotAllPortfolios(now = new Date()) {
  const portfolios = await db.portfolio.findMany({ include: portfolioInclude });
  const active = portfolios.filter((p) => leagueStatus(p.league, now) === "ACTIVE");
  const values = await valuePortfolios(active, now);
  const takenAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const result = await db.portfolioSnapshot.createMany({
    data: active.map((p) => ({
      portfolioId: p.id,
      takenAt,
      totalValueCents: values.get(p.id)!.totalValueCents,
      cashCents: p.cashCents,
    })),
    skipDuplicates: true,
  });
  return { portfolios: active.length, written: result.count };
}

const RANGE_MS: Record<ChartRange, number> = {
  "1D": 86_400_000,
  "1W": 7 * 86_400_000,
  "1M": 30 * 86_400_000,
  "1Y": 365 * 86_400_000,
};

/**
 * Portfolio value over time.
 *
 * Since the last trade the holdings haven't changed, so for that window the
 * value is *exactly* cash + Σ quantity × price(t): we rebuild it from each
 * holding's price history at chart resolution. Before the last trade we use
 * recorded snapshots (one per trade plus a daily cron), anchored at the range
 * start by the last snapshot before it.
 */
export async function getPortfolioHistory(
  portfolioId: string,
  range: ChartRange,
  now = new Date(),
): Promise<PricePoint[]> {
  const from = new Date(now.getTime() - RANGE_MS[range]);
  const [before, inRange, detail, lastTrade] = await Promise.all([
    db.portfolioSnapshot.findFirst({
      where: { portfolioId, takenAt: { lt: from } },
      orderBy: { takenAt: "desc" },
    }),
    db.portfolioSnapshot.findMany({
      where: { portfolioId, takenAt: { gte: from } },
      orderBy: { takenAt: "asc" },
      take: 2_000,
    }),
    getPortfolioDetail(portfolioId),
    db.trade.findFirst({ where: { portfolioId }, orderBy: { executedAt: "desc" }, select: { executedAt: true } }),
  ]);
  const live = await valuePortfolioNow(detail, now);
  const exactFrom = Math.max(from.getTime(), (lastTrade?.executedAt ?? detail.joinedAt).getTime());

  const points: PricePoint[] = [];
  if (before) points.push({ t: from.getTime(), p: before.totalValueCents });
  for (const s of inRange)
    if (s.takenAt.getTime() < exactFrom) points.push({ t: s.takenAt.getTime(), p: s.totalValueCents });

  // Exact reconstruction since the last trade.
  if (detail.holdings.length) {
    const anchors = await getQuotes(
      detail.holdings.map((h) => h.symbol),
      detail.league.marketSource,
      { now },
    );
    const series = await Promise.all(
      detail.holdings.map((h) => getHistory(h.symbol, detail.league.marketSource, range, now, anchors.get(h.symbol))),
    );
    const timeline = series[0]!.points;
    const aligned = series.every((s) => s.points.length === timeline.length);
    if (aligned) {
      timeline.forEach((pt, i) => {
        if (pt.t < exactFrom || pt.t >= now.getTime()) return;
        const holdingsValue = detail.holdings.reduce((sum, h, j) => sum + h.quantity * series[j]!.points[i]!.p, 0);
        points.push({ t: pt.t, p: detail.cashCents + holdingsValue });
      });
    }
  } else {
    points.push({ t: exactFrom, p: live.totalValueCents });
  }
  points.push({ t: now.getTime(), p: live.totalValueCents });

  points.sort((a, b) => a.t - b.t);
  // collapse duplicate timestamps (keep the latest value)
  return points.filter((pt, i) => i === points.length - 1 || points[i + 1]!.t !== pt.t);
}

/** Value at the start of the current day, for the 1D change on dashboards. */
export async function getStartOfDayValue(portfolioId: string, fallbackCents: number, now = new Date()) {
  const from = new Date(now.getTime() - RANGE_MS["1D"]);
  const snap =
    (await db.portfolioSnapshot.findFirst({
      where: { portfolioId, takenAt: { lt: from } },
      orderBy: { takenAt: "desc" },
    })) ?? (await db.portfolioSnapshot.findFirst({ where: { portfolioId }, orderBy: { takenAt: "asc" } }));
  return snap?.totalValueCents ?? fallbackCents;
}
