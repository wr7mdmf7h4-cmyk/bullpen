import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";
import { SYSTEM_LEAGUES } from "@/domain/leagues";
import { joinSystemLeagues } from "./membership";

export const ACTIVE_LEAGUE_COOKIE = "bp_league";

/** All leagues the user plays in, system leagues first. */
export const getMyPortfolios = cache(async (userId: string) => {
  const portfolios = await db.portfolio.findMany({
    where: { userId },
    include: { league: true },
    orderBy: { joinedAt: "asc" },
  });
  const order = { GLOBAL: 0, PRACTICE: 1, PRIVATE: 2 } as const;
  return portfolios.sort((a, b) => order[a.league.kind] - order[b.league.kind]);
});

/**
 * The league the user is currently "in" (picked in the header switcher and
 * stored in a cookie). Markets, stock pages and the portfolio all follow it.
 */
export const getActivePortfolio = cache(async (userId: string) => {
  let portfolios = await getMyPortfolios(userId);
  if (!portfolios.length) {
    // e.g. a user created before system leagues existed
    await joinSystemLeagues(userId);
    portfolios = await db.portfolio.findMany({ where: { userId }, include: { league: true } });
  }
  const wanted = (await cookies()).get(ACTIVE_LEAGUE_COOKIE)?.value ?? SYSTEM_LEAGUES.global.id;
  return (
    portfolios.find((p) => p.leagueId === wanted) ??
    portfolios.find((p) => p.leagueId === SYSTEM_LEAGUES.global.id) ??
    portfolios[0]!
  );
});
