import "server-only";
import { db } from "./db";
import { valuePortfolios } from "./portfolio";
import { rankLeaderboard } from "@/domain/leaderboard";
import { rankTitle } from "@/domain/ranks";
import { activityPayloadSchema, describeActivity } from "@/domain/activity";
import { SYSTEM_LEAGUES } from "@/domain/leagues";

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  avatarSeed: string;
  totalValueCents: number;
  returnCents: number;
  returnBps: number;
  tradeCount: number;
  title: string;
  titleEmoji: string;
};

// Leaderboards are polled by every open league page; a tiny per-instance cache
// keeps that from turning into N valuations per second.
const cache = new Map<string, { at: number; rows: LeaderboardRow[] }>();
const TTL_MS = 4_000;

export function invalidateLeaderboard(leagueId: string) {
  cache.delete(leagueId);
}

type Entry = {
  userId: string;
  username: string;
  avatarSeed: string;
  totalValueCents: number;
  startingCashCents: number;
  tradeCount: number;
  joinedAt: Date;
};

/**
 * Values every portfolio in the league at current prices and ranks by return.
 * Fine at demo scale; at real scale this would read from periodically
 * materialised snapshots instead (see README → "What I'd build next").
 */
export async function getLeaderboard(leagueId: string, now = new Date()): Promise<LeaderboardRow[]> {
  const hit = cache.get(leagueId);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.rows;

  const league = await db.league.findUnique({ where: { id: leagueId }, select: { portfolioMode: true, endsAt: true } });
  const entries =
    league?.portfolioMode === "LINKED"
      ? await linkedEntries(leagueId, league.endsAt, now)
      : await separateEntries(leagueId, now);

  const ranked = rankLeaderboard(entries);
  const avatars = new Map(entries.map((e) => [e.userId, e.avatarSeed]));
  const rows = ranked.map((e) => {
    const title = rankTitle(e.returnBps);
    return {
      rank: e.rank,
      userId: e.userId,
      username: e.username,
      avatarSeed: avatars.get(e.userId)!,
      totalValueCents: e.totalValueCents,
      returnCents: e.returnCents,
      returnBps: e.returnBps,
      tradeCount: e.tradeCount,
      title: title.title,
      titleEmoji: title.emoji,
    };
  });
  cache.set(leagueId, { at: now.getTime(), rows });
  return rows;
}

/** Each player has their own portfolio in the league, measured from the league's starting cash. */
async function separateEntries(leagueId: string, now: Date): Promise<Entry[]> {
  const portfolios = await db.portfolio.findMany({
    where: { leagueId, user: { username: { not: null } } },
    include: {
      holdings: { select: { symbol: true, quantity: true, costBasisCents: true } },
      league: { select: { startingCashCents: true } },
      user: { select: { id: true, username: true, avatarSeed: true } },
    },
  });
  const values = await valuePortfolios(portfolios, now);
  return portfolios.map((p) => ({
    userId: p.userId,
    username: p.user.username!,
    avatarSeed: p.user.avatarSeed,
    totalValueCents: values.get(p.id)!.totalValueCents,
    startingCashCents: p.league.startingCashCents,
    tradeCount: p.tradeCount,
    joinedAt: p.joinedAt,
  }));
}

/**
 * Everyone plays with their main portfolio, measured from its value when they
 * joined. Once the league has ended, the main portfolio's last recorded value
 * before the end is used, so final standings stay put.
 */
async function linkedEntries(leagueId: string, endsAt: Date | null, now: Date): Promise<Entry[]> {
  const members = await db.portfolio.findMany({
    where: { leagueId, user: { username: { not: null } } },
    select: {
      userId: true,
      joinedAt: true,
      baselineCents: true,
      user: { select: { username: true, avatarSeed: true } },
    },
  });
  if (!members.length) return [];
  const mains = await db.portfolio.findMany({
    where: { leagueId: SYSTEM_LEAGUES.global.id, userId: { in: members.map((m) => m.userId) } },
    include: {
      holdings: { select: { symbol: true, quantity: true, costBasisCents: true } },
      league: { select: { startingCashCents: true } },
    },
  });
  const mainByUser = new Map(mains.map((p) => [p.userId, p]));
  const ended = endsAt !== null && endsAt <= now;

  const values = new Map<string, number>();
  if (ended) {
    const finals = await Promise.all(
      mains.map((p) =>
        db.portfolioSnapshot.findFirst({
          where: { portfolioId: p.id, takenAt: { lte: endsAt } },
          orderBy: { takenAt: "desc" },
          select: { totalValueCents: true },
        }),
      ),
    );
    mains.forEach((p, i) => {
      const final = finals[i];
      if (final) values.set(p.id, final.totalValueCents);
    });
  }
  const live = await valuePortfolios(
    mains.filter((p) => !values.has(p.id)),
    now,
  );
  for (const [id, v] of live) values.set(id, v.totalValueCents);

  const tradeCounts = await Promise.all(
    members.map((m) => {
      const main = mainByUser.get(m.userId);
      if (!main) return 0;
      return db.trade.count({
        where: { portfolioId: main.id, executedAt: { gte: m.joinedAt, ...(ended ? { lte: endsAt } : {}) } },
      });
    }),
  );

  return members.flatMap((m, i) => {
    const main = mainByUser.get(m.userId);
    if (!main) return [];
    const value = values.get(main.id)!;
    return [
      {
        userId: m.userId,
        username: m.user.username!,
        avatarSeed: m.user.avatarSeed,
        totalValueCents: value,
        startingCashCents: m.baselineCents ?? value,
        tradeCount: tradeCounts[i]!,
        joinedAt: m.joinedAt,
      },
    ];
  });
}

export type ActivityItem = {
  id: string;
  username: string;
  avatarSeed: string;
  text: string;
  emoji: string;
  tone: "gain" | "loss" | "neutral" | "celebrate";
  symbol: string | null;
  createdAt: number;
};

export async function getActivity(leagueId: string, take = 30): Promise<ActivityItem[]> {
  const events = await db.activityEvent.findMany({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { username: true, avatarSeed: true } } },
  });
  return events.flatMap((e) => {
    const payload = activityPayloadSchema.safeParse(e.payload);
    if (!payload.success || !e.user.username) return [];
    const d = describeActivity(e.user.username, payload.data);
    return [
      {
        id: e.id,
        username: e.user.username,
        avatarSeed: e.user.avatarSeed,
        ...d,
        symbol: payload.data.type === "TRADE" ? payload.data.symbol : null,
        createdAt: e.createdAt.getTime(),
      },
    ];
  });
}
