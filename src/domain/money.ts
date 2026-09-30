/**
 * Money helpers. All amounts are integer cents; percentages are integer basis
 * points (1 bp = 0.01%). Multiplication/division goes through BigInt so large
 * intermediate products can never lose precision, and every rounding step is
 * explicit (half-up, away from zero).
 */

export type Cents = number;
export type Bps = number;

export const BPS_PER_UNIT = 10_000;

export function assertCents(value: number, label = "amount"): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of cents, got ${value}`);
  }
}

/** round(a * b / divisor), half away from zero, exact for any safe integers. */
export function mulDivRound(a: number, b: number, divisor: number): number {
  if (divisor === 0) throw new RangeError("division by zero");
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(divisor);
  const negative = num < 0n !== den < 0n;
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  const q = (absNum * 2n + absDen) / (absDen * 2n);
  const result = Number(negative ? -q : q);
  if (!Number.isSafeInteger(result)) throw new RangeError("result exceeds safe integer range");
  return result;
}

/** (part / whole) expressed in basis points, rounded half-up. */
export function ratioBps(part: number, whole: number): Bps {
  if (whole === 0) return 0;
  return mulDivRound(part, BPS_PER_UNIT, whole);
}

/**
 * Parse a user-entered dollar string ("10,000", "$9.5", "12.34") into cents
 * without ever going through a float. Returns null when invalid.
 */
export function parseDollars(input: string): Cents | null {
  const cleaned = input.replace(/[\s,$]/g, "");
  const match = /^(\d{1,12})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return dollars * 100 + cents;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formats cents as dollars. Integer → string conversion only; no float maths. */
export function formatCents(cents: Cents, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const body =
    opts.compact && abs >= 1_000_000
      ? usdCompact.format(abs / 100)
      : usd.format(whole).replace(/\.00$/, "") + "." + String(frac).padStart(2, "0");
  if (negative) return `-${body}`;
  return opts.sign && cents > 0 ? `+${body}` : body;
}

/** Formats basis points as a percentage, e.g. 1234 → "12.34%". */
export function formatBps(bps: Bps, opts: { sign?: boolean; decimals?: 0 | 1 | 2 } = {}): string {
  const decimals = opts.decimals ?? 2;
  const negative = bps < 0;
  const abs = Math.abs(bps);
  // bps / 100 = percent. Round to requested decimals with integer maths.
  const scale = 10 ** (2 - decimals);
  const rounded = Math.round(abs / scale); // abs is an integer; this is exact
  const intPart = Math.trunc(rounded / 10 ** decimals);
  const fracPart = rounded % 10 ** decimals;
  const body = decimals === 0 ? `${intPart}` : `${intPart}.${String(fracPart).padStart(decimals, "0")}`;
  const sign = negative && rounded !== 0 ? "-" : opts.sign && bps > 0 ? "+" : "";
  return `${sign}${body}%`;
}
