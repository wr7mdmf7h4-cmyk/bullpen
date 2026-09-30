import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executeTrade, TradeError } from "@/server/trading/execute";
import { getQuote } from "@/server/market";
import { quoteOrder } from "@/domain/trading";

/**
 * Proves the trading engine's concurrency guarantees against a real Postgres:
 * row locking, idempotency and CHECK constraints.
 */

const NOW = new Date("2026-06-15T15:00:00Z");
const SYMBOL = "AAPL";

async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "ActivityEvent", "UserAchievement", "PortfolioSnapshot", "Trade", "Holding", "Portfolio", "League", "User", "QuoteCache" CASCADE`,
  );
}

async function createPlayer(startingCashCents: number) {
  const user = await db.user.create({
    data: {
      email: `p${Date.now()}${Math.random()}@test.dev`,
      username: `p${Math.floor(Math.random() * 1e9)}`,
      avatarSeed: "x",
    },
  });
  const league = await db.league.create({
    data: {
      name: "Test league",
      kind: "PRIVATE",
      marketSource: "SIMULATED", // always open, deterministic prices
      inviteCode: `T${Math.floor(Math.random() * 1e8)}`,
      startsAt: new Date("2026-01-01"),
      endsAt: null,
      startingCashCents,
    },
  });
  const portfolio = await db.portfolio.create({
    data: { userId: user.id, leagueId: league.id, cashCents: startingCashCents },
  });
  return { user, league, portfolio };
}

describe("trading engine (integration)", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await db.$disconnect();
  });

  it("never lets simultaneous buys overspend", async () => {
    const price = (await getQuote(SYMBOL, "SIMULATED", NOW)).priceCents;
    const fees = { flatCents: 100, bps: 10 };
    const quantity = 3;
    const orderCost = quoteOrder("BUY", quantity, price, fees).totalCents;
    // Enough cash for exactly two orders, not three.
    const startingCash = orderCost * 2 + Math.floor(orderCost / 2);
    const { user, league, portfolio } = await createPlayer(startingCash);

    const attempts = 8;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        executeTrade({
          userId: user.id,
          leagueId: league.id,
          symbol: SYMBOL,
          side: "BUY",
          quantity,
          expectedPriceCents: price,
          idempotencyKey: crypto.randomUUID(),
          now: NOW,
        }),
      ),
    );

    const filled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(filled).toHaveLength(2);
    expect(rejected).toHaveLength(attempts - 2);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(TradeError);
      expect((r.reason as TradeError).code).toBe("INSUFFICIENT_FUNDS");
    }

    const after = await db.portfolio.findUniqueOrThrow({ where: { id: portfolio.id }, include: { holdings: true } });
    expect(after.cashCents).toBe(startingCash - 2 * orderCost);
    expect(after.cashCents).toBeGreaterThanOrEqual(0);
    expect(after.holdings[0]?.quantity).toBe(2 * quantity);
    expect(after.tradeCount).toBe(2);

    // Ledger invariant: cash = starting cash + sum of every trade's cash delta.
    const ledger = await db.trade.aggregate({ where: { portfolioId: portfolio.id }, _sum: { netCashCents: true } });
    expect(after.cashCents).toBe(startingCash + (ledger._sum.netCashCents ?? 0));
  });

  it("treats a double-submitted order (same idempotency key) as one trade", async () => {
    const price = (await getQuote(SYMBOL, "SIMULATED", NOW)).priceCents;
    const { user, league, portfolio } = await createPlayer(1_000_000);
    const key = crypto.randomUUID();
    const order = {
      userId: user.id,
      leagueId: league.id,
      symbol: SYMBOL,
      side: "BUY" as const,
      quantity: 1,
      expectedPriceCents: price,
      idempotencyKey: key,
      now: NOW,
    };

    const results = await Promise.all([executeTrade(order), executeTrade(order), executeTrade(order)]);
    expect(new Set(results.map((r) => r.trade.id)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await db.trade.count({ where: { portfolioId: portfolio.id } })).toBe(1);
  });

  it("never lets simultaneous sells oversell a position", async () => {
    const price = (await getQuote(SYMBOL, "SIMULATED", NOW)).priceCents;
    const { user, league, portfolio } = await createPlayer(1_000_000);
    const base = { userId: user.id, leagueId: league.id, symbol: SYMBOL, expectedPriceCents: price, now: NOW };
    await executeTrade({ ...base, side: "BUY", quantity: 5, idempotencyKey: crypto.randomUUID() });

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        executeTrade({ ...base, side: "SELL", quantity: 3, idempotencyKey: crypto.randomUUID() }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const holding = await db.holding.findUnique({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: SYMBOL } },
    });
    expect(holding?.quantity).toBe(2);
  });

  it("is backed by CHECK constraints even if application code misbehaves", async () => {
    const { portfolio } = await createPlayer(100);
    await expect(
      db.portfolio.update({ where: { id: portfolio.id }, data: { cashCents: { decrement: 101 } } }),
    ).rejects.toThrow(/portfolio_cash_non_negative/);
  });

  it("rejects trading before a league starts", async () => {
    const { user, league } = await createPlayer(1_000_000);
    await db.league.update({ where: { id: league.id }, data: { startsAt: new Date("2027-01-01") } });
    await expect(
      executeTrade({
        userId: user.id,
        leagueId: league.id,
        symbol: SYMBOL,
        side: "BUY",
        quantity: 1,
        expectedPriceCents: 1,
        idempotencyKey: crypto.randomUUID(),
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "LEAGUE_NOT_STARTED" });
  });
});
