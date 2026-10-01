/** Admin dashboard rules: pure functions, no I/O. */

/** Days on the admin dashboard are counted in the owner's time zone. */
export const ADMIN_TIME_ZONE = "Europe/London";

/** ADMIN_EMAILS="me@example.com, partner@example.com" → a lowercase set. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string, admins: Set<string>): boolean {
  return email !== "" && admins.has(email.toLowerCase());
}

/** Calendar day ("YYYY-MM-DD") of an instant in a time zone. */
export function dayKey(d: Date, timeZone = ADMIN_TIME_ZONE): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The `days` calendar days ending today, oldest first. */
export function lastDays(now: Date, days: number, timeZone: string): string[] {
  const today = new Date(`${dayKey(now, timeZone)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** How many of `dates` fall on each of the last `days` days (zero days included). */
export function dailyCounts(
  dates: Date[],
  now: Date,
  days: number,
  timeZone = ADMIN_TIME_ZONE,
): { day: string; count: number }[] {
  const counts = new Map(lastDays(now, days, timeZone).map((day) => [day, 0]));
  for (const d of dates) {
    const key = dayKey(d, timeZone);
    const n = counts.get(key);
    if (n !== undefined) counts.set(key, n + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count }));
}
