/**
 * Deterministic FAKE market, for development and automated tests only
 * (FAKE_MARKET_DATA=1; refused in production). Real users only ever see real
 * Finnhub prices.
 *
 * Price is a pure function of (symbol, time): the log-price is a sum of
 * smooth value-noise "octaves" (2 minutes → 1 year) whose amplitudes scale
 * with √period, like a random walk, plus a small per-symbol drift. Because it
 * is stateless, every serverless instance agrees on every price without a
 * shared store or a background ticker, and any historical point can be
 * computed in O(1). Floats are fine here: this *generates* prices, which are
 * rounded to integer cents before they touch any money maths.
 */

import type { InstrumentDef } from "./universe";
import { getMarketHours, previousSessionClose, sessionOn, sessionsBetween, nyParts, type Session } from "./hours";
import { rangeStartMs, type ChartRange, type PricePoint, type Quote } from "./types";

export type MarketCalendar = "ALWAYS" | "NYSE";

const YEAR_MS = 365.25 * 86_400_000;
const REFERENCE_TIME = Date.UTC(2026, 0, 1);
/** Prices only change every 5 seconds, so the quote a user confirms is the price they get. */
export const TICK_MS = 5_000;

const OCTAVES_MS = [
  2 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 3_600_000,
  86_400_000,
  5 * 86_400_000,
  20 * 86_400_000,
  90 * 86_400_000,
  365 * 86_400_000,
];

/** 32-bit string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer hash → uniform float in [-1, 1]. */
function lattice(seed: number, octave: number, index: number): number {
  let h = seed ^ Math.imul(octave + 1, 0x9e3779b1) ^ Math.imul(index | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

function valueNoise(seed: number, octave: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f); // smoothstep
  const a = lattice(seed, octave, i);
  const b = lattice(seed, octave, i + 1);
  return a + (b - a) * u;
}

export function quantize(t: number): number {
  return Math.floor(t / TICK_MS) * TICK_MS;
}

/** Raw simulated price in cents at time `t` (ms since epoch), ignoring market hours. */
export function simulatedPriceCents(def: InstrumentDef, t: number): number {
  const seed = hashString(def.symbol);
  const tq = quantize(t);
  let logPrice = 0;
  for (let k = 0; k < OCTAVES_MS.length; k++) {
    const period = OCTAVES_MS[k]!;
    const amplitude = def.vol * Math.sqrt(period / YEAR_MS) * 1.1;
    // Offset each octave so their lattice points don't line up.
    logPrice += amplitude * valueNoise(seed, k, tq / period + (seed % 997) / 997);
  }
  // Gentle per-symbol drift between -8% and +22% a year.
  const drift = -0.08 + ((seed % 1000) / 1000) * 0.3;
  logPrice += (drift * (tq - REFERENCE_TIME)) / YEAR_MS;
  return Math.max(1, Math.round(def.basePrice * 100 * Math.exp(logPrice)));
}

type Window = { from: number; to: number; stepMs: number };

function sampleRange(def: InstrumentDef, windows: Window[], filter?: (t: number) => boolean): PricePoint[] {
  const points: PricePoint[] = [];
  for (const w of windows) {
    for (let t = w.from; t < w.to; t += w.stepMs) {
      if (!filter || filter(t)) points.push({ t, p: simulatedPriceCents(def, t) });
    }
    points.push({ t: w.to, p: simulatedPriceCents(def, w.to) });
  }
  return points;
}

function utcDayStart(t: number): number {
  return Math.floor(t / 86_400_000) * 86_400_000;
}

function sessionContaining(t: Date): Session {
  const p = nyParts(t);
  const s = sessionOn({ y: p.y, m: p.m, d: p.d });
  if (!s) throw new Error("no session on this day");
  return s;
}

/** The instant whose price is "the current price" for this calendar. */
export function effectiveTime(calendar: MarketCalendar, now: Date): number {
  if (calendar === "ALWAYS") return quantize(now.getTime());
  const hours = getMarketHours(now);
  return hours.isOpen ? quantize(now.getTime()) : hours.lastClose.getTime();
}

export function simulatedQuote(def: InstrumentDef, calendar: MarketCalendar, now: Date): Quote {
  const t = effectiveTime(calendar, now);
  const priceCents = simulatedPriceCents(def, t);

  let dayStart: number;
  let prevCloseCents: number;
  if (calendar === "ALWAYS") {
    dayStart = utcDayStart(t);
    prevCloseCents = simulatedPriceCents(def, dayStart);
  } else {
    const session = sessionContaining(new Date(t));
    dayStart = session.open.getTime();
    prevCloseCents = simulatedPriceCents(def, previousSessionClose(session.open).getTime());
  }

  const intraday = sampleRange(def, [{ from: dayStart, to: t, stepMs: 5 * 60_000 }]);
  let high = priceCents;
  let low = priceCents;
  for (const pt of intraday) {
    if (pt.p > high) high = pt.p;
    if (pt.p < low) low = pt.p;
  }

  return {
    symbol: def.symbol,
    priceCents,
    prevCloseCents,
    openCents: intraday[0]?.p ?? priceCents,
    highCents: high,
    lowCents: low,
    asOf: new Date(t),
    source: "simulated",
  };
}

/** Sampling step for the 24/7 calendar: ~150-400 points per range. */
const ALWAYS_STEP_MS: Record<ChartRange, number> = {
  "1D": 5 * 60_000,
  "1W": 30 * 60_000,
  "1M": 3 * 3_600_000,
  "3M": 8 * 3_600_000,
  "6M": 12 * 3_600_000,
  YTD: 86_400_000,
  "1Y": 86_400_000,
  "5Y": 7 * 86_400_000,
};

function closesOf(def: InstrumentDef, sessions: Session[], end: number): PricePoint[] {
  return sessions
    .filter((s) => s.close.getTime() <= end)
    .map((s) => ({ t: s.close.getTime(), p: simulatedPriceCents(def, s.close.getTime()) }));
}

/** Last session of each ISO-ish week (weeks start Monday, UTC). */
function weeklyCloses(sessions: Session[]): Session[] {
  const out: Session[] = [];
  for (const s of sessions) {
    const week = Math.floor((s.open.getTime() / 86_400_000 + 3) / 7); // epoch was a Thursday
    const lastWeek = out.length ? Math.floor((out[out.length - 1]!.open.getTime() / 86_400_000 + 3) / 7) : -1;
    if (week === lastWeek) out[out.length - 1] = s;
    else out.push(s);
  }
  return out;
}

/**
 * Price history for a chart range. NYSE calendars only include trading
 * hours: intraday points for short ranges, daily closes for 3M–1Y and weekly
 * closes for 5Y.
 */
export function simulatedHistory(
  def: InstrumentDef,
  calendar: MarketCalendar,
  range: ChartRange,
  now: Date,
): PricePoint[] {
  const end = effectiveTime(calendar, now);
  const start = Math.min(rangeStartMs(range, end), end - ALWAYS_STEP_MS["1D"]);

  if (calendar === "ALWAYS") {
    return sampleRange(def, [{ from: start, to: end, stepMs: ALWAYS_STEP_MS[range] }]);
  }

  if (range === "1D") {
    const s = sessionContaining(new Date(end));
    return sampleRange(def, [{ from: s.open.getTime(), to: end, stepMs: 5 * 60_000 }]);
  }

  const sessions = sessionsBetween(new Date(start), new Date(end));
  if (range === "1W" || range === "1M") {
    const step = range === "1W" ? 30 * 60_000 : 2 * 3_600_000;
    return sampleRange(
      def,
      sessions
        .map((s) => ({ from: s.open.getTime(), to: Math.min(s.close.getTime(), end), stepMs: step }))
        .filter((w) => w.to > w.from),
    );
  }

  const pts = closesOf(def, range === "5Y" ? weeklyCloses(sessions) : sessions, end);
  if (!pts.length || pts[pts.length - 1]!.t !== end) pts.push({ t: end, p: simulatedPriceCents(def, end) });
  if (pts.length === 1) pts.unshift({ t: start, p: simulatedPriceCents(def, start) }); // e.g. YTD on 2 January
  return pts;
}

/** 52-week high/low from daily samples. */
export function simulatedYearRange(def: InstrumentDef, calendar: MarketCalendar, now: Date) {
  const pts = simulatedHistory(def, calendar, "1Y", now);
  let high = 0;
  let low = Number.MAX_SAFE_INTEGER;
  for (const pt of pts) {
    high = Math.max(high, pt.p);
    low = Math.min(low, pt.p);
  }
  return { highCents: high, lowCents: low };
}
