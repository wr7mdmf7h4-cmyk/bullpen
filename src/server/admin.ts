import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { isAdmin } from "./moderation";
import { requireUser } from "./users";
import { dailyCounts } from "@/domain/admin";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** "Online now" = made a request in the last 10 minutes (last-seen is refreshed every ~2 minutes). */
export const ONLINE_WINDOW_MS = 10 * 60_000;
export const CHART_DAYS = 30;
export const LIST_LIMIT = 50;

export { isAdmin };

/** Admins only. Everyone else gets a plain 404, so the page's existence isn't revealed. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!isAdmin(user.email)) notFound();
  return user;
}

/** Players whose username or email contains the search text. */
function playerFilter(q: string) {
  if (!q) return {};
  return {
    OR: [
      { username: { contains: q, mode: "insensitive" as const } },
      { email: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

/** Everything the admin dashboard shows, in one round of queries. */
export async function getAdminStats({ now = new Date(), query = "" }: { now?: Date; query?: string } = {}) {
  const q = query.trim().slice(0, 100);
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const [
    totalUsers,
    recentSignupDates,
    onlineNow,
    active24h,
    active7d,
    totalTrades,
    trades24h,
    privateLeagues,
    usersWhoTraded,
    players,
    matchingPlayers,
    onlineUsers,
    recentTrades,
    leagues,
  ] = await Promise.all([
    db.user.count(),
    db.user.findMany({ where: { createdAt: { gte: ago((CHART_DAYS + 1) * DAY_MS) } }, select: { createdAt: true } }),
    db.user.count({ where: { lastSeenAt: { gte: ago(ONLINE_WINDOW_MS) } } }),
    db.user.count({ where: { lastSeenAt: { gte: ago(DAY_MS) } } }),
    db.user.count({ where: { lastSeenAt: { gte: ago(7 * DAY_MS) } } }),
    db.trade.count(),
    db.trade.count({ where: { executedAt: { gte: ago(DAY_MS) } } }),
    db.league.count({ where: { kind: "PRIVATE" } }),
    db.user.count({ where: { portfolios: { some: { tradeCount: { gt: 0 } } } } }),
    db.user.findMany({
      where: playerFilter(q),
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
        portfolios: { select: { tradeCount: true } },
      },
    }),
    q ? db.user.count({ where: playerFilter(q) }) : Promise.resolve(null),
    db.user.findMany({
      where: { lastSeenAt: { gte: ago(ONLINE_WINDOW_MS) } },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      select: { id: true, username: true, lastSeenAt: true },
    }),
    db.trade.findMany({
      orderBy: { executedAt: "desc" },
      take: 20,
      select: {
        id: true,
        side: true,
        symbol: true,
        quantity: true,
        priceCents: true,
        executedAt: true,
        portfolio: { select: { user: { select: { username: true } }, league: { select: { name: true } } } },
      },
    }),
    db.league.findMany({
      where: { kind: "PRIVATE" },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: { select: { username: true } },
        _count: { select: { portfolios: true } },
      },
    }),
  ]);

  const signupsByDay = dailyCounts(
    recentSignupDates.map((u) => u.createdAt),
    now,
    CHART_DAYS,
  );
  const signups = (ms: number) => recentSignupDates.filter((u) => u.createdAt >= ago(ms)).length;

  return {
    generatedAt: now,
    totals: {
      users: totalUsers,
      signups24h: signups(DAY_MS),
      signups7d: signups(7 * DAY_MS),
      signups30d: signups(30 * DAY_MS),
      onlineNow,
      active24h,
      active7d,
      trades: totalTrades,
      trades24h,
      privateLeagues,
      usersWhoTraded,
    },
    signupsByDay,
    query: q,
    matchingPlayers: matchingPlayers ?? totalUsers,
    players: players.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      trades: u.portfolios.reduce((n, p) => n + p.tradeCount, 0),
      isAdmin: isAdmin(u.email),
    })),
    onlineUsers,
    recentTrades: recentTrades.map((t) => ({
      id: t.id,
      side: t.side,
      symbol: t.symbol,
      quantity: t.quantity,
      priceCents: t.priceCents,
      executedAt: t.executedAt,
      username: t.portfolio.user.username,
      league: t.portfolio.league.name,
    })),
    leagues: leagues.map((l) => ({
      id: l.id,
      name: l.name,
      createdAt: l.createdAt,
      host: l.owner?.username ?? null,
      players: l._count.portfolios,
    })),
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
