import { describe, expect, it } from "vitest";
import { DEFAULT_FEES } from "./fees";
import {
  applyBuy,
  applySell,
  averageCostCents,
  exceedsSlippage,
  maxAffordableShares,
  quoteOrder,
  validateOrder,
} from "./trading";

const NO_FEES = { flatCents: 0, bps: 0 };

describe("quoteOrder", () => {
  it("adds fees to buys and subtracts them from sells", () => {
    const buy = quoteOrder("BUY", 10, 10_000, DEFAULT_FEES); // 10 × $100
    expect(buy).toMatchObject({ notionalCents: 100_000, feeCents: 200, totalCents: 100_200, netCashCents: -100_200 });
    const sell = quoteOrder("SELL", 10, 10_000, DEFAULT_FEES);
    expect(sell).toMatchObject({ totalCents: 99_800, netCashCents: 99_800 });
  });

  it("rejects fractional shares and non-positive prices", () => {
    expect(() => quoteOrder("BUY", 1.5, 100, DEFAULT_FEES)).toThrow();
    expect(() => quoteOrder("BUY", 1, 0, DEFAULT_FEES)).toThrow();
  });
});

describe("validateOrder", () => {
  const base = { priceCents: 10_000, fees: DEFAULT_FEES, cashCents: 1_000_000, heldQuantity: 0 };

  it("accepts an affordable buy", () => {
    expect(validateOrder({ ...base, side: "BUY", quantity: 99 }).ok).toBe(true);
  });

  it("rejects overspending, counting the fee", () => {
    // 100 × $100 = $10,000 exactly, but the $11 fee tips it over
    const res = validateOrder({ ...base, side: "BUY", quantity: 100 });
    expect(res).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" });
  });

  it("rejects selling shares you don't own", () => {
    expect(validateOrder({ ...base, side: "SELL", quantity: 1 })).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_SHARES",
    });
    expect(validateOrder({ ...base, side: "SELL", quantity: 6, heldQuantity: 5 })).toMatchObject({
      ok: false,
      code: "INSUFFICIENT_SHARES",
      message: "You only own 5 shares.",
    });
  });

  it("rejects sells whose fee exceeds the proceeds", () => {
    const res = validateOrder({ ...base, side: "SELL", quantity: 1, priceCents: 50, heldQuantity: 1 });
    expect(res).toMatchObject({ ok: false, code: "PROCEEDS_BELOW_FEE" });
  });

  it("rejects zero, fractional and oversized quantities", () => {
    expect(validateOrder({ ...base, side: "BUY", quantity: 0 })).toMatchObject({ code: "INVALID_QUANTITY" });
    expect(validateOrder({ ...base, side: "BUY", quantity: 2.5 })).toMatchObject({ code: "INVALID_QUANTITY" });
    expect(validateOrder({ ...base, side: "BUY", quantity: 100_001, priceCents: 1 })).toMatchObject({
      code: "ORDER_TOO_LARGE",
    });
  });
});

describe("position maths", () => {
  it("capitalises buy fees into the cost basis", () => {
    const pos = applyBuy(null, quoteOrder("BUY", 10, 10_000, DEFAULT_FEES));
    expect(pos).toEqual({ quantity: 10, costBasisCents: 100_200 });
    expect(averageCostCents(pos)).toBe(10_020);
  });

  it("averages cost across multiple buys", () => {
    let pos = applyBuy(null, quoteOrder("BUY", 10, 10_000, NO_FEES));
    pos = applyBuy(pos, quoteOrder("BUY", 10, 20_000, NO_FEES));
    expect(pos).toEqual({ quantity: 20, costBasisCents: 300_000 });
    expect(averageCostCents(pos)).toBe(15_000);
  });

  it("realises P&L on a partial sell using pro-rata cost", () => {
    const pos = { quantity: 20, costBasisCents: 300_000 }; // avg $150
    const res = applySell(pos, quoteOrder("SELL", 5, 20_000, NO_FEES)); // sell 5 @ $200
    expect(res.costRemovedCents).toBe(75_000);
    expect(res.realizedPnlCents).toBe(25_000);
    expect(res.remaining).toEqual({ quantity: 15, costBasisCents: 225_000 });
  });

  it("removes exactly the remaining basis when closing (no rounding dust)", () => {
    const pos = { quantity: 3, costBasisCents: 1_000 }; // 333.33¢ each
    const first = applySell(pos, quoteOrder("SELL", 1, 400, NO_FEES));
    expect(first.costRemovedCents).toBe(333);
    const second = applySell(first.remaining!, quoteOrder("SELL", 2, 400, NO_FEES));
    expect(second.remaining).toBeNull();
    expect(first.costRemovedCents + second.costRemovedCents).toBe(1_000);
  });

  it("includes the sell fee in realised P&L", () => {
    const pos = applyBuy(null, quoteOrder("BUY", 10, 10_000, DEFAULT_FEES)); // basis $1,002
    const res = applySell(pos, quoteOrder("SELL", 10, 10_000, DEFAULT_FEES)); // proceeds $998
    expect(res.realizedPnlCents).toBe(-400); // round trip at flat price costs both fees
  });

  it("refuses to oversell", () => {
    expect(() => applySell({ quantity: 1, costBasisCents: 100 }, quoteOrder("SELL", 2, 100, NO_FEES))).toThrow();
  });
});

describe("maxAffordableShares", () => {
  it("finds the largest quantity that fits including fees", () => {
    const q = maxAffordableShares(1_000_000, 10_000, DEFAULT_FEES);
    expect(q).toBe(99);
    expect(quoteOrder("BUY", q, 10_000, DEFAULT_FEES).totalCents).toBeLessThanOrEqual(1_000_000);
    expect(quoteOrder("BUY", q + 1, 10_000, DEFAULT_FEES).totalCents).toBeGreaterThan(1_000_000);
  });

  it("is zero when cash can't even cover the flat fee", () => {
    expect(maxAffordableShares(50, 10, DEFAULT_FEES)).toBe(0);
  });

  it.each([
    [1_000_000, 123],
    [987_654, 4_567],
    [100_000, 99_999],
    [10_001, 1],
  ])("holds for cash=%i price=%i", (cash, price) => {
    const q = maxAffordableShares(cash, price, DEFAULT_FEES);
    if (q > 0) expect(quoteOrder("BUY", q, price, DEFAULT_FEES).totalCents).toBeLessThanOrEqual(cash);
    expect(quoteOrder("BUY", q + 1, price, DEFAULT_FEES).totalCents).toBeGreaterThan(cash);
  });
});

describe("exceedsSlippage", () => {
  it("allows small moves and rejects large ones", () => {
    expect(exceedsSlippage(10_000, 10_150)).toBe(false); // 1.5%
    expect(exceedsSlippage(10_000, 10_300)).toBe(true); // 3%
    expect(exceedsSlippage(10_000, 9_700)).toBe(true); // -3%
  });
});
