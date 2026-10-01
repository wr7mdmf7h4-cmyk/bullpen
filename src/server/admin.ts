import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";
import { env } from "./env";
import { requireUser } from "./users";
import { dailyCounts, isAdminEmail, parseAdminEmails } from "@/domain/admin";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** "Online now" = made a request in the last 10 minutes (last-seen is refreshed every ~2 minutes). */
export const ONLINE_WINDOW_MS = 10 * 60_000;
export const CHART_DAYS = 30;

export function isAdmin(email: string) {
  return isAdminEmail(email, parseAdminEmails(env().ADMIN_EMAILS));
}

/** Admins only. Everyone else gets a plain 404, so the page's existence isn't revealed. */
export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!isAdmin(user.email)) notFound();
  return user;
}

/** Everything the admin dashboard shows, in one round of queries. */
export async function getAdminStats(now = new Date()) {
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
    recentSignups,
    onlineUsers,
    recentTrades,
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
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
        portfolios: { select: { tradeCount: true } },
      },
    }),
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
    recentSignups: recentSignups.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      trades: u.portfolios.reduce((n, p) => n + p.tradeCount, 0),
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
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
