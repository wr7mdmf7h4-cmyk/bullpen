/**
 * Trade maths. Pure functions over integer cents and whole shares; the
 * server layer wraps these in a locked database transaction.
 *
 * Conventions (same as most retail brokers):
 * - Buy fees are capitalised into the cost basis.
 * - Sell fees reduce proceeds, and so reduce realised P&L.
 * - Selling part of a position removes a pro-rata share of the cost basis.
 */

import { calculateFee, type FeeSchedule } from "./fees";
import { mulDivRound, ratioBps, type Cents } from "./money";

export type Side = "BUY" | "SELL";

export const MAX_ORDER_QUANTITY = 100_000;
/** Reject if the price moved more than this between confirm and execution. */
export const DEFAULT_SLIPPAGE_BPS = 200; // 2%

export type Position = { quantity: number; costBasisCents: Cents };

export type OrderQuote = {
  side: Side;
  quantity: number;
  priceCents: Cents;
  notionalCents: Cents;
  feeCents: Cents;
  /** what the user pays (buy) or receives (sell) */
  totalCents: Cents;
  /** signed change to cash: negative for buys */
  netCashCents: Cents;
};

export function quoteOrder(side: Side, quantity: number, priceCents: Cents, fees: FeeSchedule): OrderQuote {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError("quantity must be a positive integer");
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) throw new RangeError("price must be a positive integer");
  const notionalCents = quantity * priceCents;
  if (!Number.isSafeInteger(notionalCents)) throw new RangeError("order too large");
  const feeCents = calculateFee(notionalCents, fees);
  const totalCents = side === "BUY" ? notionalCents + feeCents : notionalCents - feeCents;
  return {
    side,
    quantity,
    priceCents,
    notionalCents,
    feeCents,
    totalCents,
    netCashCents: side === "BUY" ? -totalCents : totalCents,
  };
}

export type RejectCode =
  "INVALID_QUANTITY" | "ORDER_TOO_LARGE" | "INSUFFICIENT_FUNDS" | "INSUFFICIENT_SHARES" | "PROCEEDS_BELOW_FEE";

export type ValidationResult = { ok: true; quote: OrderQuote } | { ok: false; code: RejectCode; message: string };

export function validateOrder(input: {
  side: Side;
  quantity: number;
  priceCents: Cents;
  fees: FeeSchedule;
  cashCents: Cents;
  heldQuantity: number;
}): ValidationResult {
  const { side, quantity, priceCents, fees, cashCents, heldQuantity } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: "INVALID_QUANTITY", message: "Enter a whole number of shares." };
  }
  if (quantity > MAX_ORDER_QUANTITY) {
    return {
      ok: false,
      code: "ORDER_TOO_LARGE",
      message: `Orders are limited to ${MAX_ORDER_QUANTITY.toLocaleString("en-US")} shares.`,
    };
  }
  const quote = quoteOrder(side, quantity, priceCents, fees);
  if (side === "BUY" && quote.totalCents > cashCents) {
    return { ok: false, code: "INSUFFICIENT_FUNDS", message: "Not enough cash to cover this order and its fee." };
  }
  if (side === "SELL" && quantity > heldQuantity) {
    return {
      ok: false,
      code: "INSUFFICIENT_SHARES",
      message: heldQuantity === 0 ? "You don't own any shares of this stock." : `You only own ${heldQuantity} shares.`,
    };
  }
  if (side === "SELL" && quote.totalCents <= 0) {
    return { ok: false, code: "PROCEEDS_BELOW_FEE", message: "The fee would be more than you'd receive." };
  }
  return { ok: true, quote };
}

export function applyBuy(position: Position | null, quote: OrderQuote): Position {
  return {
    quantity: (position?.quantity ?? 0) + quote.quantity,
    costBasisCents: (position?.costBasisCents ?? 0) + quote.notionalCents + quote.feeCents,
  };
}

export function applySell(
  position: Position,
  quote: OrderQuote,
): { remaining: Position | null; costRemovedCents: Cents; realizedPnlCents: Cents } {
  if (quote.quantity > position.quantity) throw new RangeError("cannot sell more than held");
  const closing = quote.quantity === position.quantity;
  const costRemovedCents = closing
    ? position.costBasisCents
    : mulDivRound(position.costBasisCents, quote.quantity, position.quantity);
  const remaining = closing
    ? null
    : { quantity: position.quantity - quote.quantity, costBasisCents: position.costBasisCents - costRemovedCents };
  return { remaining, costRemovedCents, realizedPnlCents: quote.totalCents - costRemovedCents };
}

/** Largest whole number of shares affordable including fees. */
export function maxAffordableShares(cashCents: Cents, priceCents: Cents, fees: FeeSchedule): number {
  if (priceCents <= 0 || cashCents <= fees.flatCents) return 0;
  // Start from the continuous estimate, then correct for rounding.
  let q = Math.floor(((cashCents - fees.flatCents) * 10_000) / (priceCents * (10_000 + fees.bps)));
  q = Math.min(Math.max(q, 0), MAX_ORDER_QUANTITY);
  while (q > 0 && quoteOrder("BUY", q, priceCents, fees).totalCents > cashCents) q--;
  while (q < MAX_ORDER_QUANTITY && quoteOrder("BUY", q + 1, priceCents, fees).totalCents <= cashCents) q++;
  return q;
}

/** True when the executable price is too far from the price the user confirmed. */
export function exceedsSlippage(
  expectedCents: Cents,
  actualCents: Cents,
  toleranceBps = DEFAULT_SLIPPAGE_BPS,
): boolean {
  return Math.abs(ratioBps(actualCents - expectedCents, expectedCents)) > toleranceBps;
}

export function averageCostCents(position: Position): Cents {
  return position.quantity > 0 ? mulDivRound(position.costBasisCents, 1, position.quantity) : 0;
}
