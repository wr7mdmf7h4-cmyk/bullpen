import "server-only";
import { db } from "./db";
import { notifyLeague } from "./realtime";
import { getAchievement, newlyUnlocked, type AchievementContext } from "@/domain/achievements";
import { ratioBps } from "@/domain/money";
import type { ActivityPayload } from "@/domain/activity";

export type UnlockedAchievement = { key: string; name: string; emoji: string; description: string };

/** Gathers everything the achievement rules need with a handful of aggregate queries. */
async function buildContext(userId: string, now: Date): Promise<AchievementContext> {
  const [totals, profitableSells, maxNotional, maxPerDay, sectors, oldest, leaguesCreated, latestSnapshots] =
    await Promise.all([
      db.portfolio.aggregate({ where: { userId }, _sum: { tradeCount: true, feesPaidCents: true } }),
      db.trade.count({ where: { portfolio: { userId }, realizedPnlCents: { gt: 0 } } }),
      db.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(t."quantity"::bigint * t."priceCents") AS max
        FROM "Trade" t JOIN "Portfolio" p ON p.id = t."portfolioId"
        WHERE p."userId" = ${userId}`,
      db.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(n) AS max FROM (
          SELECT COUNT(*) AS n
          FROM "Trade" t JOIN "Portfolio" p ON p.id = t."portfolioId"
          WHERE p."userId" = ${userId}
          GROUP BY date_trunc('day', t."executedAt")
        ) per_day`,
      db.$queryRaw<{ max: bigint | null }[]>`
        SELECT MAX(n) AS max FROM (
          SELECT COUNT(DISTINCT i."sector") AS n
          FROM "Holding" h
          JOIN "Portfolio" p ON p.id = h."portfolioId"
          JOIN "Instrument" i ON i.symbol = h.symbol
          WHERE p."userId" = ${userId} AND i."sector" NOT IN ('ETF', 'Unknown')
          GROUP BY h."portfolioId"
        ) per_portfolio`,
      db.holding.findFirst({
        where: { portfolio: { userId } },
        orderBy: { openedAt: "asc" },
        select: { openedAt: true },
      }),
      db.league.count({ where: { ownerId: userId, kind: "PRIVATE" } }),
      db.$queryRaw<{ totalValueCents: number; startingCashCents: number }[]>`
        SELECT DISTINCT ON (s."portfolioId") s."totalValueCents", l."startingCashCents"
        FROM "PortfolioSnapshot" s
        JOIN "Portfolio" p ON p.id = s."portfolioId"
        JOIN "League" l ON l.id = p."leagueId"
        WHERE p."userId" = ${userId}
        ORDER BY s."portfolioId", s."takenAt" DESC`,
    ]);

  const bestReturnBps = latestSnapshots.reduce(
    (best, s) => Math.max(best, ratioBps(s.totalValueCents - s.startingCashCents, s.startingCashCents)),
    Number.MIN_SAFE_INTEGER,
  );

  return {
    now,
    totalTrades: totals._sum.tradeCount ?? 0,
    totalFeesPaidCents: totals._sum.feesPaidCents ?? 0,
    profitableSells,
    maxTradeNotionalCents: Number(maxNotional[0]?.max ?? 0),
    maxTradesInOneDay: Number(maxPerDay[0]?.max ?? 0),
    maxSectorsHeld: Number(sectors[0]?.max ?? 0),
    oldestOpenPositionAt: oldest?.openedAt ?? null,
    leaguesCreated,
    bestReturnBps: latestSnapshots.length ? bestReturnBps : 0,
  };
}

/**
 * Evaluates the rules, records anything newly unlocked (idempotently) and
 * announces it in each of the user's league feeds. Returns the new badges so
 * the UI can pop a toast.
 */
export async function evaluateAchievements(userId: string, now = new Date()): Promise<UnlockedAchievement[]> {
  const [ctx, existing] = await Promise.all([
    buildContext(userId, now),
    db.userAchievement.findMany({ where: { userId }, select: { achievementKey: true } }),
  ]);
  const keys = newlyUnlocked(
    ctx,
    existing.map((e) => e.achievementKey),
  );
  if (!keys.length) return [];

  // skipDuplicates makes concurrent evaluations safe; only rows we actually
  // inserted get announced.
  const inserted: string[] = [];
  for (const key of keys) {
    const res = await db.userAchievement.createMany({
      data: [{ userId, achievementKey: key, unlockedAt: now }],
      skipDuplicates: true,
    });
    if (res.count) inserted.push(key);
  }
  if (!inserted.length) return [];

  const leagues = await db.portfolio.findMany({ where: { userId }, select: { leagueId: true } });
  await db.activityEvent.createMany({
    data: leagues.flatMap(({ leagueId }) =>
      inserted.map((key) => ({
        leagueId,
        userId,
        type: "ACHIEVEMENT" as const,
        payload: { type: "ACHIEVEMENT", key } satisfies ActivityPayload,
        createdAt: now,
      })),
    ),
  });
  await Promise.all(leagues.map(({ leagueId }) => notifyLeague(leagueId, "activity")));

  return inserted.map((key) => {
    const def = getAchievement(key)!;
    return { key, name: def.name, emoji: def.emoji, description: def.description };
  });
}
