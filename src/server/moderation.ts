import "server-only";
import { db } from "./db";
import { env } from "./env";
import { isAdminEmail, parseAdminEmails } from "@/domain/admin";

/** Admin moderation: removing players and leagues. Callers must check the admin first. */

export class AdminError extends Error {}

export function isAdmin(email: string) {
  return isAdminEmail(email, parseAdminEmails(env().ADMIN_EMAILS));
}

/**
 * Permanently removes a player: their account, portfolios, trades, badges and
 * activity. Private leagues they were in carry on: if they hosted one, the
 * longest-standing remaining member takes over, and a league left with nobody
 * in it is deleted.
 */
export async function deletePlayer(userId: string, actingAdminId: string) {
  if (userId === actingAdminId) throw new AdminError("You can't remove your own account.");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        portfolios: { select: { leagueId: true, league: { select: { kind: true, ownerId: true } } } },
      },
    });
    if (!user) throw new AdminError("That player has already been removed.");
    if (isAdmin(user.email)) throw new AdminError("Admins can't be removed here.");

    const keptLeagues: string[] = [];
    const deletedLeagues: string[] = [];
    for (const { leagueId, league } of user.portfolios) {
      if (league.kind !== "PRIVATE") {
        keptLeagues.push(leagueId);
        continue;
      }
      const next = await tx.portfolio.findFirst({
        where: { leagueId, userId: { not: userId } },
        orderBy: { joinedAt: "asc" },
        select: { userId: true },
      });
      if (!next) {
        await tx.league.delete({ where: { id: leagueId } });
        deletedLeagues.push(leagueId);
        continue;
      }
      if (league.ownerId === userId) {
        await tx.league.update({ where: { id: leagueId }, data: { ownerId: next.userId } });
      }
      keptLeagues.push(leagueId);
    }
    // Cascades to portfolios, holdings, trades, snapshots, badges and activity.
    await tx.user.delete({ where: { id: userId } });
    return { username: user.username, keptLeagues, deletedLeagues };
  });
}

/** Deletes a private league and every portfolio in it. The Global League can't be deleted. */
export async function deleteLeagueAsAdmin(leagueId: string) {
  const league = await db.league.findUnique({ where: { id: leagueId }, select: { name: true, kind: true } });
  if (!league) throw new AdminError("That league has already been deleted.");
  if (league.kind === "GLOBAL") throw new AdminError("The Global League can't be deleted.");
  // Cascades to portfolios (and their holdings, trades, snapshots) and activity;
  // anyone viewing it falls back to their most recently used league.
  await db.league.delete({ where: { id: leagueId } });
  return { name: league.name };
}
