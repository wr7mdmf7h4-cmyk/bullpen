import { mulDivRound, BPS_PER_UNIT, formatBps, formatCents, type Cents } from "./money";

/**
 * Fee model: flat fee + a percentage of the order's notional value.
 * Configured per league (default $1.00 + 0.10%). The percentage part is
 * rounded half-up to the cent.
 */
export type FeeSchedule = {
  flatCents: Cents;
  /** basis points of notional, e.g. 10 = 0.10% */
  bps: number;
};

export const DEFAULT_FEES: FeeSchedule = { flatCents: 100, bps: 10 };

export function calculateFee(notionalCents: Cents, schedule: FeeSchedule): Cents {
  if (notionalCents < 0) throw new RangeError("notional must be non-negative");
  if (schedule.flatCents < 0 || schedule.bps < 0) throw new RangeError("fees must be non-negative");
  return schedule.flatCents + mulDivRound(notionalCents, schedule.bps, BPS_PER_UNIT);
}

/** Splits a fee into its two parts for display ("$1.00 + $0.23"). */
export function feeBreakdown(notionalCents: Cents, schedule: FeeSchedule) {
  const variable = mulDivRound(notionalCents, schedule.bps, BPS_PER_UNIT);
  return { flatCents: schedule.flatCents, variableCents: variable, totalCents: schedule.flatCents + variable };
}

export function describeFees(schedule: FeeSchedule): string {
  const flat = formatCents(schedule.flatCents);
  const pct = formatBps(schedule.bps).replace(/\.?0+%$/, "%");
  if (schedule.bps === 0 && schedule.flatCents === 0) return "No fees";
  if (schedule.bps === 0) return `${flat} per trade`;
  if (schedule.flatCents === 0) return `${pct} per trade`;
  return `${flat} + ${pct} per trade`;
}
