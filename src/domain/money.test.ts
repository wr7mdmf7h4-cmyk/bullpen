import { describe, expect, it } from "vitest";
import { formatBps, formatCents, mulDivRound, parseDollars, ratioBps } from "./money";

describe("mulDivRound", () => {
  it("rounds half away from zero", () => {
    expect(mulDivRound(5, 1, 10)).toBe(1); // 0.5 → 1
    expect(mulDivRound(4, 1, 10)).toBe(0); // 0.4 → 0
    expect(mulDivRound(-5, 1, 10)).toBe(-1); // -0.5 → -1
    expect(mulDivRound(15, 1, 10)).toBe(2); // 1.5 → 2
  });

  it("is exact for products beyond 2^53", () => {
    // 9e15 * 3 overflows float precision, BigInt keeps it exact
    expect(mulDivRound(9_000_000_000_000_000 / 1000, 3000, 1000)).toBe(27_000_000_000_000);
  });

  it("rejects division by zero", () => {
    expect(() => mulDivRound(1, 1, 0)).toThrow(RangeError);
  });
});

describe("ratioBps", () => {
  it("expresses a ratio in basis points", () => {
    expect(ratioBps(1, 100)).toBe(100);
    expect(ratioBps(-250, 10_000)).toBe(-250);
    expect(ratioBps(1, 3)).toBe(3333);
  });
  it("returns 0 for a zero denominator", () => {
    expect(ratioBps(5, 0)).toBe(0);
  });
});

describe("parseDollars", () => {
  it.each([
    ["10000", 1_000_000],
    ["$10,000", 1_000_000],
    ["12.3", 1230],
    ["12.34", 1234],
    ["0.05", 5],
  ])("%s → %i cents", (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });
  it.each(["", "abc", "1.234", "-5", "1e5"])("rejects %j", (input) => {
    expect(parseDollars(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats cents without float artefacts", () => {
    expect(formatCents(1_000_000)).toBe("$10,000.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(-12_345)).toBe("-$123.45");
    expect(formatCents(250, { sign: true })).toBe("+$2.50");
    expect(formatCents(0, { sign: true })).toBe("$0.00");
  });
  it("formats basis points as percentages", () => {
    expect(formatBps(1234)).toBe("12.34%");
    expect(formatBps(-5)).toBe("-0.05%");
    expect(formatBps(1234, { sign: true })).toBe("+12.34%");
    expect(formatBps(1250, { decimals: 1 })).toBe("12.5%");
    expect(formatBps(-2, { decimals: 1 })).toBe("0.0%");
  });
});
