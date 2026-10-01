import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { AdminError, deleteLeagueAsAdmin, deletePlayer } from "@/server/moderation";

/** Admin moderation: removing players and leagues keeps the rest of the game consistent. */

async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "ActivityEvent", "UserAchievement", "PortfolioSnapshot", "Trade", "Holding", "Portfolio", "League", "User" CASCADE`,
  );
}

let n = 0;
async function player(name: string) {
  n++;
  return db.user.create({ data: { email: `${name}${n}@test.dev`, username: `${name}${n}`, avatarSeed: name } });
}

async function league(ownerId: string | null, kind: "PRIVATE" | "GLOBAL" = "PRIVATE") {
  return db.league.create({
    data: {
      ...(kind === "GLOBAL" ? { id: "global" } : { inviteCode: `C${Math.floor(Math.random() * 1e8)}` }),
      name: kind === "GLOBAL" ? "Global League" : "Friends",
      kind,
      ownerId,
      startsAt: new Date("2026-01-01"),
    },
  });
}

async function join(userId: string, leagueId: string, joinedAt = new Date()) {
  return db.portfolio.create({ data: { userId, leagueId, cashCents: 1_000_000, joinedAt } });
}

describe("admin moderation (integration)", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("removes a player and everything they own, handing their leagues on", async () => {
    const admin = await player("admin");
    const bad = await player("bad");
    const early = await player("early");
    const late = await player("late");
    const global = await league(null, "GLOBAL");
    const shared = await league(bad.id);
    const solo = await league(bad.id);
    await join(bad.id, global.id);
    await join(bad.id, shared.id, new Date("2026-02-01"));
    await join(early.id, shared.id, new Date("2026-02-02"));
    await join(late.id, shared.id, new Date("2026-02-03"));
    await join(bad.id, solo.id);
    await db.userAchievement.create({ data: { userId: bad.id, achievementKey: "first-trade" } });

    const result = await deletePlayer(bad.id, admin.id);

    expect(result.deletedLeagues).toEqual([solo.id]);
    expect(await db.user.count({ where: { id: bad.id } })).toBe(0);
    expect(await db.portfolio.count({ where: { userId: bad.id } })).toBe(0);
    expect(await db.userAchievement.count({ where: { userId: bad.id } })).toBe(0);
    // the longest-standing remaining member takes over the shared league
    expect((await db.league.findUniqueOrThrow({ where: { id: shared.id } })).ownerId).toBe(early.id);
    expect(await db.portfolio.count({ where: { leagueId: shared.id } })).toBe(2);
    // a league with nobody left is removed; the Global League stays
    expect(await db.league.count({ where: { id: solo.id } })).toBe(0);
    expect(await db.league.count({ where: { id: global.id } })).toBe(1);
  });

  it("won't remove the acting admin's own account", async () => {
    const admin = await player("admin");
    await expect(deletePlayer(admin.id, admin.id)).rejects.toBeInstanceOf(AdminError);
    expect(await db.user.count({ where: { id: admin.id } })).toBe(1);
  });

  it("reports a player who is already gone", async () => {
    const admin = await player("admin");
    await expect(deletePlayer("missing", admin.id)).rejects.toBeInstanceOf(AdminError);
  });

  it("deletes a private league with its portfolios, but never the Global League", async () => {
    const owner = await player("owner");
    const friend = await player("friend");
    const global = await league(null, "GLOBAL");
    const friends = await league(owner.id);
    await join(owner.id, friends.id);
    await join(friend.id, friends.id);
    await db.user.update({ where: { id: friend.id }, data: { activeLeagueId: friends.id } });

    await expect(deleteLeagueAsAdmin(friends.id)).resolves.toMatchObject({ name: "Friends" });
    expect(await db.league.count({ where: { id: friends.id } })).toBe(0);
    expect(await db.portfolio.count({ where: { leagueId: friends.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).activeLeagueId).toBeNull();

    await expect(deleteLeagueAsAdmin(global.id)).rejects.toBeInstanceOf(AdminError);
    expect(await db.league.count({ where: { id: global.id } })).toBe(1);
  });
});
