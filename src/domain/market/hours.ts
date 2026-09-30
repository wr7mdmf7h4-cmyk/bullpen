/**
 * US equity market hours (NYSE/NASDAQ regular session), computed purely from a
 * timestamp. Handles weekends, exchange holidays, early closes and DST (via
 * Intl's America/New_York rules). Holiday tables need a yearly refresh.
 */

const TZ = "America/New_York";

/** Full-day closures, NYSE calendar. */
export const NYSE_HOLIDAYS = new Set([
  // 2025
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
  "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** 1:00 pm ET early closes. */
export const NYSE_EARLY_CLOSES = new Set([
  "2025-07-03", "2025-11-28", "2025-12-24",
  "2026-11-27", "2026-12-24",
  "2027-11-26",
]);

const OPEN_MINUTES = 9 * 60 + 30;
const CLOSE_MINUTES = 16 * 60;
const EARLY_CLOSE_MINUTES = 13 * 60;

type YMD = { y: number; m: number; d: number };

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of `date` in New York. */
export function nyParts(date: Date) {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday!]!,
  };
}

function key({ y, m, d }: YMD) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays({ y, m, d }: YMD, days: number): YMD {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekdayOf({ y, m, d }: YMD) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Converts a New York wall-clock time into a UTC instant (DST-aware). */
export function nyTimeToUtc({ y, m, d }: YMD, minutesOfDay: number): Date {
  const h = Math.floor(minutesOfDay / 60);
  const min = minutesOfDay % 60;
  const naive = Date.UTC(y, m - 1, d, h, min);
  let guess = naive;
  // Two passes settle the offset even right next to a DST transition.
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(guess));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second);
    guess = naive - (asUtc - guess);
  }
  return new Date(guess);
}

export function isTradingDay(day: YMD): boolean {
  const wd = weekdayOf(day);
  return wd !== 0 && wd !== 6 && !NYSE_HOLIDAYS.has(key(day));
}

export type Session = { open: Date; close: Date };

export function sessionOn(day: YMD): Session | null {
  if (!isTradingDay(day)) return null;
  const closeMinutes = NYSE_EARLY_CLOSES.has(key(day)) ? EARLY_CLOSE_MINUTES : CLOSE_MINUTES;
  return { open: nyTimeToUtc(day, OPEN_MINUTES), close: nyTimeToUtc(day, closeMinutes) };
}

export type MarketHoursStatus = {
  isOpen: boolean;
  /** the session currently in progress, if any */
  session: Session | null;
  nextOpen: Date;
  /** close of the most recent session that has finished (or is finishing now) */
  lastClose: Date;
};

export function getMarketHours(now: Date): MarketHoursStatus {
  const p = nyParts(now);
  const today: YMD = { y: p.y, m: p.m, d: p.d };
  const todays = sessionOn(today);
  const isOpen = Boolean(todays && now >= todays.open && now < todays.close);

  let nextOpen: Date | undefined;
  if (todays && now < todays.open) nextOpen = todays.open;
  for (let i = 1; !nextOpen && i <= 14; i++) nextOpen = sessionOn(addDays(today, i))?.open;

  let lastClose: Date | undefined;
  if (todays && now >= todays.close) lastClose = todays.close;
  for (let i = 1; !lastClose && i <= 14; i++) lastClose = sessionOn(addDays(today, -i))?.close;

  return { isOpen, session: isOpen ? todays : null, nextOpen: nextOpen!, lastClose: lastClose! };
}

export function isMarketOpen(now: Date): boolean {
  return getMarketHours(now).isOpen;
}

/** Close of the last session that ended strictly before `t`. */
export function previousSessionClose(t: Date): Date {
  const p = nyParts(t);
  const day: YMD = { y: p.y, m: p.m, d: p.d };
  const todays = sessionOn(day);
  if (todays && t > todays.close) return todays.close;
  for (let i = 1; i <= 14; i++) {
    const s = sessionOn(addDays(day, -i));
    if (s) return s.close;
  }
  throw new Error("no session in the last 14 days");
}

/** All sessions whose open falls within [from, to]. */
export function sessionsBetween(from: Date, to: Date): Session[] {
  const out: Session[] = [];
  const p = nyParts(from);
  let day: YMD = { y: p.y, m: p.m, d: p.d };
  for (let i = 0; i < 400; i++) {
    const s = sessionOn(day);
    if (s && s.open > to) break;
    if (s && s.close >= from) out.push(s);
    day = addDays(day, 1);
    if (nyTimeToUtc(day, 0) > to) break;
  }
  return out;
}
