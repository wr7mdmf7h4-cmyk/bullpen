import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { joinLeague } from "./membership";
import { INVITE_CODE_LENGTH, inviteCodeFromBytes, leagueStatus } from "@/domain/leagues";

export type CreateLeagueInput = {
  name: string;
  startsAt: Date;
  endsAt: Date;
  startingCashCents: number;
  feeFlatCents: number;
  feeBps: number;
};

/** Creates a private league with a unique invite code; the owner joins automatically. */
export async function createLeague(ownerId: string, input: CreateLeagueInput) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const league = await db.league.create({
        data: {
          ...input,
          kind: "PRIVATE",
          ownerId,
          inviteCode: inviteCodeFromBytes(randomBytes(INVITE_CODE_LENGTH)),
          maxMembers: 100,
        },
      });
      await joinLeague(ownerId, league.id);
      return league;
    } catch (err) {
      // 31^8 codes make collisions vanishingly rare, but handle them anyway.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique invite code");
}

export async function findLeagueByInvite(code: string) {
  return db.league.findUnique({
    where: { inviteCode: code },
    include: { owner: { select: { username: true } }, _count: { select: { portfolios: true } } },
  });
}

export class JoinError extends Error {}

export async function joinByInvite(userId: string, code: string, now = new Date()) {
  const league = await findLeagueByInvite(code);
  if (!league) throw new JoinError("That invite code doesn't match any league.");
  if (leagueStatus(league, now) === "ENDED") throw new JoinError("That league has already ended.");
  const { joined } = await joinLeague(userId, league.id);
  return { league, joined };
}

/** The user's leagues with light stats for the leagues page. */
export async function listMyLeagues(userId: string) {
  return db.portfolio.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: { league: { include: { _count: { select: { portfolios: true } } } } },
  });
}

export async function getLeagueForMember(leagueId: string, userId: string) {
  const portfolio = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
    include: {
      league: { include: { owner: { select: { username: true } }, _count: { select: { portfolios: true } } } },
    },
  });
  return portfolio;
}

export class LeaveError extends Error {}

/**
 * Leaves a private league: the member's portfolio (cash, holdings, trades,
 * snapshots) and their activity there are deleted in one transaction. If the
 * owner leaves, ownership passes to the longest-standing member; a league
 * left empty is deleted.
 */
export async function leaveLeague(userId: string, leagueId: string) {
  return db.$transaction(async (tx) => {
    const league = await tx.league.findUnique({ where: { id: leagueId }, select: { kind: true, ownerId: true } });
    if (!league) throw new LeaveError("That league doesn't exist.");
    if (league.kind === "GLOBAL") throw new LeaveError("Everyone plays in the Global League, so it can't be left.");

    const removed = await tx.portfolio.deleteMany({ where: { userId, leagueId } });
    if (!removed.count) throw new LeaveError("You're not in that league.");
    await tx.activityEvent.deleteMany({ where: { userId, leagueId } });

    const next = await tx.portfolio.findFirst({
      where: { leagueId },
      orderBy: { joinedAt: "asc" },
      select: { userId: true },
    });
    if (!next) {
      await tx.league.delete({ where: { id: leagueId } });
      return { deletedLeague: true };
    }
    if (league.ownerId === userId) {
      await tx.league.update({ where: { id: leagueId }, data: { ownerId: next.userId } });
    }
    return { deletedLeague: false };
  });
}
