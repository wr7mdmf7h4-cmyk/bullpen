import "server-only";
import { db } from "./db";
import { getQuotes } from "./market";
import { valuePortfolio, type PortfolioValuation } from "@/domain/portfolio";
import { leagueStatus } from "@/domain/leagues";
import { rangeStartMs, type ChartRange, type PricePoint } from "@/domain/market/types";

type PortfolioWithHoldings = {
  id: string;
  cashCents: number;
  holdings: { symbol: string; quantity: number; costBasisCents: number }[];
  league: { startingCashCents: number };
};

/**
 * Values one portfolio at current real prices. A holding without a price
 * right now is valued at its average cost (never at an invented price).
 */
export async function valuePortfolioNow(p: PortfolioWithHoldings, now = new Date()): Promise<PortfolioValuation> {
  const symbols = p.holdings.map((h) => h.symbol);
  const quotes = symbols.length ? await getQuotes(symbols, { now }) : new Map();
  const prices = new Map([...quotes.values()].map((q) => [q.symbol, q.priceCents]));
  return valuePortfolio(p.cashCents, p.holdings, prices, p.league.startingCashCents);
}

/** Values many portfolios with a single quote lookup. Used by leaderboards and the daily cron. */
export async function valuePortfolios<T extends PortfolioWithHoldings>(
  portfolios: T[],
  now = new Date(),
): Promise<Map<string, PortfolioValuation>> {
  const symbols = new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.symbol)));
  const quotes = symbols.size ? await getQuotes([...symbols], { now, maxFetch: 20 }) : new Map();
  const prices = new Map([...quotes.values()].map((q) => [q.symbol, q.priceCents]));
  return new Map(
    portfolios.map((p) => [p.id, valuePortfolio(p.cashCents, p.holdings, prices, p.league.startingCashCents)]),
  );
}

const portfolioInclude = {
  holdings: { select: { symbol: true, quantity: true, costBasisCents: true, openedAt: true } },
  league: true,
} as const;

export async function getPortfolioDetail(portfolioId: string) {
  return db.portfolio.findUniqueOrThrow({ where: { id: portfolioId }, include: portfolioInclude });
}

/** Records the portfolio's value right now (after every trade, and on views). */
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

const VIEW_SNAPSHOT_INTERVAL_MS = 15 * 60_000;

/**
 * Snapshot on view, at most every 15 minutes: portfolio charts are drawn only
 * from recorded real values, so this is how intraday history accumulates.
 */
export async function maybeRecordSnapshot(portfolioId: string, now = new Date()) {
  const last = await db.portfolioSnapshot.findFirst({
    where: { portfolioId },
    orderBy: { takenAt: "desc" },
    select: { takenAt: true },
  });
  if (last && now.getTime() - last.takenAt.getTime() < VIEW_SNAPSHOT_INTERVAL_MS) return;
  await recordSnapshot(portfolioId, now);
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

/**
 * Portfolio value over time, drawn only from recorded real values: snapshots
 * taken on every trade, on views (max every 15 min) and by the daily cron,
 * anchored at the range start by the last snapshot before it, ending at the
 * live value.
 */
export async function getPortfolioHistory(
  portfolioId: string,
  range: ChartRange,
  now = new Date(),
): Promise<PricePoint[]> {
  const from = new Date(rangeStartMs(range, now.getTime()));
  const [before, inRange, detail] = await Promise.all([
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
  ]);
  const live = await valuePortfolioNow(detail, now);

  const points: PricePoint[] = [];
  if (before) points.push({ t: from.getTime(), p: before.totalValueCents });
  for (const s of inRange) points.push({ t: s.takenAt.getTime(), p: s.totalValueCents });
  points.push({ t: now.getTime(), p: live.totalValueCents });
  // collapse duplicate timestamps (keep the latest value)
  return points.filter((pt, i) => i === points.length - 1 || points[i + 1]!.t !== pt.t);
}

/** Value at the start of the current day, for the 1D change on dashboards. */
export async function getStartOfDayValue(portfolioId: string, fallbackCents: number, now = new Date()) {
  const from = new Date(rangeStartMs("1D", now.getTime()));
  const snap =
    (await db.portfolioSnapshot.findFirst({
      where: { portfolioId, takenAt: { lt: from } },
      orderBy: { takenAt: "desc" },
    })) ?? (await db.portfolioSnapshot.findFirst({ where: { portfolioId }, orderBy: { takenAt: "asc" } }));
  return snap?.totalValueCents ?? fallbackCents;
}
