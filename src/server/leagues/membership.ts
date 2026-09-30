import "server-only";
import { db } from "../db";
import { Prisma } from "@/generated/prisma/client";
import { SYSTEM_LEAGUES } from "@/domain/leagues";
import type { ActivityPayload } from "@/domain/activity";
import { ensureReferenceData } from "../reference-data";
import { notifyLeague } from "../realtime";

export class LeagueFullError extends Error {
  constructor() {
    super("This league is full");
  }
}

/**
 * Joins a league, creating a fresh portfolio funded with the league's starting
 * cash. Idempotent: joining twice returns the existing portfolio.
 */
export async function joinLeague(userId: string, leagueId: string) {
  const existing = await db.portfolio.findUnique({ where: { userId_leagueId: { userId, leagueId } } });
  if (existing) return { portfolio: existing, joined: false };

  try {
    const portfolio = await db.$transaction(async (tx) => {
      const league = await tx.league.findUniqueOrThrow({
        where: { id: leagueId },
        select: { startingCashCents: true, maxMembers: true, _count: { select: { portfolios: true } } },
      });
      if (league._count.portfolios >= league.maxMembers) throw new LeagueFullError();

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
      const payload: ActivityPayload = { type: "JOINED" };
      await tx.activityEvent.create({ data: { leagueId, userId, type: "JOINED", payload } });
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

/** Every user plays in the Global and 24/7 Practice leagues. */
export async function joinSystemLeagues(userId: string) {
  await ensureReferenceData();
  await joinLeague(userId, SYSTEM_LEAGUES.global.id);
  await joinLeague(userId, SYSTEM_LEAGUES.practice.id);
}
