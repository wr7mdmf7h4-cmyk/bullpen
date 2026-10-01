import "server-only";
import { cache } from "react";
import { db } from "../db";
import { pickActiveLeague, SYSTEM_LEAGUES } from "@/domain/leagues";
import { getMainPortfolio, joinSystemLeagues } from "./membership";

/** All leagues the user plays in, system leagues first. */
export const getMyPortfolios = cache(async (userId: string) => {
  const portfolios = await db.portfolio.findMany({
    where: { userId },
    include: { league: true },
    orderBy: { joinedAt: "asc" },
  });
  const order = { GLOBAL: 0, PRIVATE: 1 } as const;
  return portfolios.sort((a, b) => order[a.league.kind] - order[b.league.kind]);
});

/**
 * The league the user is currently "in" (picked in the header switcher and
 * saved on their account) and the portfolio they trade with there. Markets,
 * stock pages and the portfolio all follow it. With no saved pick, it's the
 * league they used most recently.
 *
 * In a LINKED league the user plays with their main (Global League)
 * portfolio, so the returned portfolio is that one; `viewLeague` is always
 * the league being looked at (for its leaderboard, feed and name).
 */
export const getActivePortfolio = cache(async (userId: string) => {
  let portfolios = await getMyPortfolios(userId);
  if (!portfolios.length) {
    // e.g. a user created before system leagues existed
    await joinSystemLeagues(userId);
    portfolios = await db.portfolio.findMany({ where: { userId }, include: { league: true } });
  }
  const [user, lastTrades] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { activeLeagueId: true } }),
    db.trade.groupBy({
      by: ["portfolioId"],
      where: { portfolioId: { in: portfolios.map((p) => p.id) } },
      _max: { executedAt: true },
    }),
  ]);
  const lastTradeAt = new Map(lastTrades.map((t) => [t.portfolioId, t._max.executedAt]));
  const leagueId = pickActiveLeague(
    portfolios.map((p) => ({ leagueId: p.leagueId, joinedAt: p.joinedAt, lastTradeAt: lastTradeAt.get(p.id) ?? null })),
    user?.activeLeagueId ?? null,
  );
  const membership = portfolios.find((p) => p.leagueId === leagueId) ?? portfolios[0]!;
  const linked = membership.league.portfolioMode === "LINKED";
  const trading = linked
    ? (portfolios.find((p) => p.leagueId === SYSTEM_LEAGUES.global.id) ??
      (await db.portfolio.findUniqueOrThrow({
        where: { id: (await getMainPortfolio(userId)).id },
        include: { league: true },
      })))
    : membership;
  return { ...trading, viewLeague: membership.league, viewLeagueId: membership.leagueId, linked };
});

/** Saves the league the app should show for this user, on every device. */
export async function setActiveLeague(userId: string, leagueId: string | null) {
  await db.user.update({ where: { id: userId }, data: { activeLeagueId: leagueId } });
}
