import { describe, expect, it } from "vitest";
import { rankLeaderboard, type LeaderboardInput } from "./leaderboard";

const player = (
  username: string,
  totalValueCents: number,
  extra: Partial<LeaderboardInput> = {},
): LeaderboardInput => ({
  userId: username,
  username,
  totalValueCents,
  startingCashCents: 1_000_000,
  tradeCount: 5,
  joinedAt: new Date("2026-01-01"),
  ...extra,
});

describe("rankLeaderboard", () => {
  it("ranks by return %, highest first", () => {
    const board = rankLeaderboard([player("a", 900_000), player("b", 1_200_000), player("c", 1_000_000)]);
    expect(board.map((e) => [e.username, e.rank, e.returnBps])).toEqual([
      ["b", 1, 2_000],
      ["c", 2, 0],
      ["a", 3, -1_000],
    ]);
  });

  it("compares % not dollars across different starting cash", () => {
    const board = rankLeaderboard([
      player("big", 2_100_000, { startingCashCents: 2_000_000 }), // +5%
      player("small", 1_100_000), // +10%
    ]);
    expect(board[0]!.username).toBe("small");
  });

  it("gives ties the same rank and skips the next (1, 2, 2, 4)", () => {
    const board = rankLeaderboard([
      player("a", 1_300_000),
      player("b", 1_100_000),
      player("c", 1_100_000),
      player("d", 1_000_000),
    ]);
    expect(board.map((e) => e.rank)).toEqual([1, 2, 2, 4]);
  });

  it("orders tied players deterministically: fewer trades, then earlier join", () => {
    const board = rankLeaderboard([
      player("busy", 1_100_000, { tradeCount: 20 }),
      player("late", 1_100_000, { tradeCount: 2, joinedAt: new Date("2026-03-01") }),
      player("early", 1_100_000, { tradeCount: 2, joinedAt: new Date("2026-02-01") }),
    ]);
    expect(board.map((e) => e.username)).toEqual(["early", "late", "busy"]);
  });

  it("handles an empty league", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});
