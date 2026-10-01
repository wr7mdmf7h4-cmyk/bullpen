import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executeTrade } from "@/server/trading/execute";
import { getActivity, getLeaderboard, invalidateLeaderboard } from "@/server/leaderboard";
import { createLeague } from "@/server/leagues/service";
import { joinLeague } from "@/server/leagues/membership";
import { getQuote } from "@/server/market";

/** Linked leagues: everyone plays with their main (Global League) portfolio. */

// Monday 11:00 ET: the US market is open.
const NOW = new Date("2026-06-15T15:00:00Z");
const SYMBOL = "AAPL";

async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "ActivityEvent", "UserAchievement", "PortfolioSnapshot", "Trade", "Holding", "Portfolio", "League", "User", "QuoteCache" CASCADE`,
  );
}

async function player(name: string) {
  const user = await db.user.create({
    data: {
      email: `${name}${Math.random()}@test.dev`,
      username: `${name}${Math.floor(Math.random() * 1e6)}`,
      avatarSeed: name,
    },
  });
  const main = await db.portfolio.create({
    data: { userId: user.id, leagueId: "global", cashCents: 1_000_000, joinedAt: new Date("2026-01-01") },
  });
  return { user, main };
}

async function buy(userId: string, leagueId: string, quantity: number) {
  const price = (await getQuote(SYMBOL, NOW)).priceCents;
  return executeTrade({
    userId,
    leagueId,
    symbol: SYMBOL,
    side: "BUY",
    quantity,
    expectedPriceCents: price,
    idempotencyKey: crypto.randomUUID(),
    now: NOW,
  });
}

describe("linked leagues (integration)", () => {
  beforeEach(async () => {
    await resetDb();
    await db.league.create({
      data: { id: "global", kind: "GLOBAL", name: "Global League", startsAt: new Date("2026-01-01") },
    });
  });
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("plays everyone's main portfolio and ranks by return since joining", async () => {
    const alice = await player("alice");
    const bob = await player("bob");
    await buy(alice.user.id, "global", 2); // alice is already invested (and paid fees) before the league exists

    const family = await createLeague(alice.user.id, {
      name: "Family",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 14 * 86_400_000),
      startingCashCents: 1_000_000,
      feeFlatCents: 100,
      feeBps: 10,
      portfolioMode: "LINKED",
    });
    const { portfolio: bobMembership } = await joinLeague(bob.user.id, family.id);

    // joining hands out no money; it records the main portfolio's value as the baseline
    expect(bobMembership.cashCents).toBe(0);
    expect(bobMembership.baselineCents).toBe(1_000_000);
    const aliceMembership = await db.portfolio.findUniqueOrThrow({
      where: { userId_leagueId: { userId: alice.user.id, leagueId: family.id } },
    });
    expect(aliceMembership.baselineCents).toBeGreaterThan(0);

    // count trades made at NOW as "after joining"
    await db.portfolio.updateMany({
      where: { leagueId: family.id },
      data: { joinedAt: new Date(NOW.getTime() - 60_000) },
    });

    // trading "in" the linked league goes to the main portfolio
    await buy(bob.user.id, family.id, 1);
    expect(await db.trade.count({ where: { portfolioId: bob.main.id } })).toBe(1);
    expect(await db.holding.count({ where: { portfolioId: bobMembership.id } })).toBe(0);
    // ...and a trade in the main portfolio shows in the linked league's feed
    await buy(bob.user.id, "global", 1);
    const feed = await getActivity(family.id);
    expect(feed.filter((a) => a.username === bob.user.username && a.symbol === SYMBOL)).toHaveLength(2);

    const now = new Date();
    invalidateLeaderboard(family.id);
    invalidateLeaderboard("global");
    const [linkedBoard, globalBoard] = await Promise.all([
      getLeaderboard(family.id, now),
      getLeaderboard("global", now),
    ]);
    const row = (board: typeof linkedBoard, userId: string) => board.find((r) => r.userId === userId)!;

    // same portfolio, so the same value in both leagues
    expect(row(linkedBoard, bob.user.id).totalValueCents).toBe(row(globalBoard, bob.user.id).totalValueCents);
    expect(row(linkedBoard, alice.user.id).totalValueCents).toBe(row(globalBoard, alice.user.id).totalValueCents);
    // but return is measured from each player's baseline, not $10,000
    const aliceValue = row(linkedBoard, alice.user.id).totalValueCents;
    expect(row(linkedBoard, alice.user.id).returnCents).toBe(aliceValue - aliceMembership.baselineCents!);
    expect(row(globalBoard, alice.user.id).returnCents).toBe(aliceValue - 1_000_000);
    expect(row(linkedBoard, bob.user.id).tradeCount).toBe(2);
  });

  it("freezes final standings at the last recorded value before the end", async () => {
    const bob = await player("bob");
    const family = await createLeague(bob.user.id, {
      name: "Family",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86_400_000),
      startingCashCents: 1_000_000,
      feeFlatCents: 100,
      feeBps: 10,
      portfolioMode: "LINKED",
    });
    const endsAt = new Date(Date.now() - 1_000);
    await db.league.update({
      where: { id: family.id },
      data: { startsAt: new Date(endsAt.getTime() - 86_400_000), endsAt },
    });
    await db.portfolioSnapshot.create({
      data: {
        portfolioId: bob.main.id,
        takenAt: new Date(endsAt.getTime() - 1_000),
        totalValueCents: 1_100_000,
        cashCents: 0,
      },
    });

    invalidateLeaderboard(family.id);
    const [mine] = await getLeaderboard(family.id);
    expect(mine!.totalValueCents).toBe(1_100_000);
    expect(mine!.returnBps).toBe(1_000); // +10% on the 1,000,000 baseline
  });
});
