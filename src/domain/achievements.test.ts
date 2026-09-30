import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, getAchievement, newlyUnlocked, type AchievementContext } from "./achievements";

const now = new Date("2026-06-01T12:00:00Z");
const empty: AchievementContext = {
  now,
  totalTrades: 0,
  profitableSells: 0,
  totalFeesPaidCents: 0,
  maxTradeNotionalCents: 0,
  maxTradesInOneDay: 0,
  maxSectorsHeld: 0,
  oldestOpenPositionAt: null,
  leaguesCreated: 0,
  bestReturnBps: 0,
};

describe("achievements", () => {
  it("has unique keys and at least 8 badges", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it("unlocks nothing for a brand-new player", () => {
    expect(newlyUnlocked(empty, [])).toEqual([]);
  });

  it.each([
    ["first_trade", { totalTrades: 1 }],
    ["in_the_green", { profitableSells: 1 }],
    ["diamond_hands", { oldestOpenPositionAt: new Date(now.getTime() - 30 * 86_400_000) }],
    ["diversified", { maxSectorsHeld: 5 }],
    ["fee_goblin", { totalFeesPaidCents: 10_000 }],
    ["high_roller", { maxTradeNotionalCents: 500_000 }],
    ["day_trader", { maxTradesInOneDay: 10 }],
    ["league_founder", { leaguesCreated: 1 }],
    ["to_the_moon", { bestReturnBps: 1_000 }],
  ] as const)("unlocks %s at its threshold", (key, patch) => {
    expect(newlyUnlocked({ ...empty, ...patch }, [])).toContain(key);
  });

  it.each([
    ["diamond_hands", { oldestOpenPositionAt: new Date(now.getTime() - 29 * 86_400_000) }],
    ["diversified", { maxSectorsHeld: 4 }],
    ["fee_goblin", { totalFeesPaidCents: 9_999 }],
    ["high_roller", { maxTradeNotionalCents: 499_999 }],
  ] as const)("does not unlock %s just below its threshold", (key, patch) => {
    expect(newlyUnlocked({ ...empty, ...patch }, [])).not.toContain(key);
  });

  it("never re-awards an achievement", () => {
    expect(newlyUnlocked({ ...empty, totalTrades: 3 }, ["first_trade"])).toEqual([]);
  });

  it("looks up definitions by key", () => {
    expect(getAchievement("fee_goblin")?.name).toBe("Fee Goblin");
    expect(getAchievement("nope")).toBeUndefined();
  });
});
