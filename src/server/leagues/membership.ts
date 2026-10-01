import "server-only";
import { db } from "../db";
import { Prisma } from "@/generated/prisma/client";
import { SYSTEM_LEAGUES } from "@/domain/leagues";
import type { ActivityPayload } from "@/domain/activity";
import { ensureReferenceData } from "../reference-data";
import { notifyLeague } from "../realtime";
import { getPortfolioDetail, valuePortfolioNow } from "../portfolio";

export class LeagueFullError extends Error {
  constructor() {
    super("This league is full");
  }
}

/**
 * Joins a league. In a SEPARATE league the player gets a fresh portfolio
 * funded with the league's starting cash. In a LINKED league they play with
 * their main (Global League) portfolio: the membership row holds no cash and
 * records the main portfolio's current value as the baseline their return
 * in this league is measured from. Idempotent: joining twice returns the
 * existing membership.
 */
export async function joinLeague(userId: string, leagueId: string, now = new Date()) {
  const existing = await db.portfolio.findUnique({ where: { userId_leagueId: { userId, leagueId } } });
  if (existing) return { portfolio: existing, joined: false };

  const mode = await db.league.findUniqueOrThrow({ where: { id: leagueId }, select: { portfolioMode: true } });
  const baselineCents = mode.portfolioMode === "LINKED" ? await mainPortfolioValue(userId, now) : null;

  try {
    const portfolio = await db.$transaction(async (tx) => {
      const league = await tx.league.findUniqueOrThrow({
        where: { id: leagueId },
        select: { startingCashCents: true, maxMembers: true, _count: { select: { portfolios: true } } },
      });
      if (league._count.portfolios >= league.maxMembers) throw new LeagueFullError();

      const payload: ActivityPayload = { type: "JOINED" };
      await tx.activityEvent.create({ data: { leagueId, userId, type: "JOINED", payload } });
      if (baselineCents !== null) {
        return tx.portfolio.create({ data: { userId, leagueId, cashCents: 0, baselineCents, joinedAt: now } });
      }
      const created = await tx.portfolio.create({
        data: { userId, leagueId, cashCents: league.startingCashCents },
      });
      await tx.portfolioSnapshot.create({
        data: {
          portfolioId: created.id,
          takenAt: created.joinedAt,
          totalValueCents: league.startingCashCents,
          cashCents: league.startingCashCents,
        },
      });
      return created;
    });
    await notifyLeague(leagueId, "activity");
    return { portfolio, joined: true };
  } catch (err) {
    // Lost a race with a concurrent join: the unique constraint caught it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const portfolio = await db.portfolio.findUniqueOrThrow({ where: { userId_leagueId: { userId, leagueId } } });
      return { portfolio, joined: false };
    }
    throw err;
  }
}

/** The player's main portfolio: their entry in the Global League. */
export async function getMainPortfolio(userId: string) {
  const main = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId, leagueId: SYSTEM_LEAGUES.global.id } },
  });
  if (main) return main;
  await joinSystemLeagues(userId);
  return db.portfolio.findUniqueOrThrow({
    where: { userId_leagueId: { userId, leagueId: SYSTEM_LEAGUES.global.id } },
  });
}

async function mainPortfolioValue(userId: string, now: Date) {
  const main = await getMainPortfolio(userId);
  const value = await valuePortfolioNow(await getPortfolioDetail(main.id), now);
  return Math.max(1, value.totalValueCents);
}

/** Every user plays in the Global league. */
export async function joinSystemLeagues(userId: string) {
  await ensureReferenceData();
  await joinLeague(userId, SYSTEM_LEAGUES.global.id);
}
