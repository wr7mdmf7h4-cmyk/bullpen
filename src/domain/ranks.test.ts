import { describe, expect, it } from "vitest";
import { nextRank, rankTitle } from "./ranks";

describe("rankTitle", () => {
  it.each([
    [-5_000, "Intern"],
    [-1, "Intern"],
    [0, "Analyst"],
    [499, "Analyst"],
    [500, "Trader"],
    [1_999, "Trader"],
    [2_000, "Whale"],
    [50_000, "Whale"],
  ])("%i bps → %s", (bps, title) => {
    expect(rankTitle(bps).title).toBe(title);
  });

  it("reports progress to the next title", () => {
    expect(nextRank(300)).toMatchObject({ rank: { title: "Trader" }, bpsToGo: 200 });
    expect(nextRank(-100)).toMatchObject({ rank: { title: "Analyst" }, bpsToGo: 100 });
    expect(nextRank(2_500)).toBeNull();
  });
});
