import "server-only";
import { db } from "./db";
import { valuePortfolios } from "./portfolio";
import { rankLeaderboard } from "@/domain/leaderboard";
import { rankTitle } from "@/domain/ranks";
import { activityPayloadSchema, describeActivity } from "@/domain/activity";

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

/**
 * Values every portfolio in the league at current prices and ranks by return.
 * Fine at demo scale; at real scale this would read from periodically
 * materialised snapshots instead (see README → "What I'd build next").
 */
export async function getLeaderboard(leagueId: string, now = new Date()): Promise<LeaderboardRow[]> {
  const hit = cache.get(leagueId);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.rows;

  const portfolios = await db.portfolio.findMany({
    where: { leagueId, user: { username: { not: null } } },
    include: {
      holdings: { select: { symbol: true, quantity: true, costBasisCents: true } },
      league: { select: { marketSource: true, startingCashCents: true } },
      user: { select: { id: true, username: true, avatarSeed: true } },
    },
  });
  const values = await valuePortfolios(portfolios, now);
  const ranked = rankLeaderboard(
    portfolios.map((p) => ({
      userId: p.userId,
      username: p.user.username!,
      totalValueCents: values.get(p.id)!.totalValueCents,
      startingCashCents: p.league.startingCashCents,
      tradeCount: p.tradeCount,
      joinedAt: p.joinedAt,
    })),
  );
  const avatars = new Map(portfolios.map((p) => [p.userId, p.user.avatarSeed]));
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
