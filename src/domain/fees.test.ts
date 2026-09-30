import { describe, expect, it } from "vitest";
import { calculateFee, DEFAULT_FEES, describeFees, feeBreakdown } from "./fees";

describe("calculateFee", () => {
  it("charges $1 + 0.1% by default", () => {
    // $2,000 order → $1.00 + $2.00
    expect(calculateFee(200_000, DEFAULT_FEES)).toBe(300);
  });

  it("rounds the percentage half-up to the cent", () => {
    // 0.1% of $12.35 = 1.235¢ → 1¢; 0.1% of $15.00 = 1.5¢ → 2¢
    expect(calculateFee(1_235, DEFAULT_FEES)).toBe(101);
    expect(calculateFee(1_500, DEFAULT_FEES)).toBe(102);
  });

  it("supports flat-only, percentage-only and free leagues", () => {
    expect(calculateFee(500_000, { flatCents: 499, bps: 0 })).toBe(499);
    expect(calculateFee(500_000, { flatCents: 0, bps: 25 })).toBe(1_250);
    expect(calculateFee(500_000, { flatCents: 0, bps: 0 })).toBe(0);
  });

  it("rejects negative inputs", () => {
    expect(() => calculateFee(-1, DEFAULT_FEES)).toThrow(RangeError);
    expect(() => calculateFee(100, { flatCents: -1, bps: 0 })).toThrow(RangeError);
  });

  it("breaks the fee into parts that sum to the total", () => {
    const b = feeBreakdown(123_456, DEFAULT_FEES);
    expect(b.flatCents + b.variableCents).toBe(b.totalCents);
    expect(b.totalCents).toBe(calculateFee(123_456, DEFAULT_FEES));
  });

  it("describes the schedule in plain English", () => {
    expect(describeFees(DEFAULT_FEES)).toBe("$1.00 + 0.1% per trade");
    expect(describeFees({ flatCents: 0, bps: 0 })).toBe("No fees");
    expect(describeFees({ flatCents: 250, bps: 0 })).toBe("$2.50 per trade");
    expect(describeFees({ flatCents: 0, bps: 100 })).toBe("1% per trade");
  });
});
