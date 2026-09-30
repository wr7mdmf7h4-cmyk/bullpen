import { describe, expect, it } from "vitest";
import { sectorAllocation, valuePortfolio } from "./portfolio";

describe("valuePortfolio", () => {
  const holdings = [
    { symbol: "AAPL", quantity: 10, costBasisCents: 200_000 }, // avg $200
    { symbol: "KO", quantity: 100, costBasisCents: 700_000 }, // avg $70
  ];

  it("values holdings at market and computes returns vs starting cash", () => {
    const v = valuePortfolio(
      100_000,
      holdings,
      new Map([
        ["AAPL", 25_000],
        ["KO", 6_500],
      ]),
      1_000_000,
    );
    expect(v.holdingsValueCents).toBe(250_000 + 650_000);
    expect(v.totalValueCents).toBe(1_000_000);
    expect(v.unrealizedPnlCents).toBe(0); // +$500 AAPL, -$500 KO
    expect(v.totalReturnBps).toBe(0);
    const aapl = v.positions.find((p) => p.symbol === "AAPL")!;
    expect(aapl.unrealizedPnlCents).toBe(50_000);
    expect(aapl.unrealizedPnlBps).toBe(2_500);
    expect(aapl.averageCostCents).toBe(20_000);
  });

  it("sorts positions by value and computes weights", () => {
    const v = valuePortfolio(0, holdings, { AAPL: 20_000, KO: 7_000 }, 900_000);
    expect(v.positions.map((p) => p.symbol)).toEqual(["KO", "AAPL"]);
    expect(v.positions[0]!.weightBps + v.positions[1]!.weightBps).toBe(10_000);
  });

  it("falls back to average cost when a price is missing", () => {
    const v = valuePortfolio(0, holdings, new Map(), 900_000);
    expect(v.totalValueCents).toBe(900_000);
    expect(v.unrealizedPnlCents).toBe(0);
  });

  it("handles an all-cash portfolio", () => {
    const v = valuePortfolio(1_050_000, [], new Map(), 1_000_000);
    expect(v.totalReturnCents).toBe(50_000);
    expect(v.totalReturnBps).toBe(500);
    expect(v.positions).toEqual([]);
  });
});

describe("sectorAllocation", () => {
  it("groups by sector and sums to 100%", () => {
    const sectors: Record<string, string> = { AAPL: "Technology", MSFT: "Technology", KO: "Consumer Staples" };
    const alloc = sectorAllocation(
      [
        { symbol: "AAPL", marketValueCents: 300 },
        { symbol: "MSFT", marketValueCents: 300 },
        { symbol: "KO", marketValueCents: 400 },
      ],
      (s) => sectors[s]!,
    );
    expect(alloc).toEqual([
      { sector: "Technology", valueCents: 600, bps: 6_000 },
      { sector: "Consumer Staples", valueCents: 400, bps: 4_000 },
    ]);
  });
});
