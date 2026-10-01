/** Page-view analytics rules: pure functions, no I/O. */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|vercel-screenshot/i;

/** Crawlers, link previews, monitoring and scripts aren't visitors. */
export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceType(userAgent: string): Device {
  if (/ipad|tablet|kindle|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

const MAX_PATH = 200;

/** "/stocks/NVDA?range=1D#x" → "/stocks/NVDA"; anything that isn't a path → null. */
export function normalizePath(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let path = raw.split(/[?#]/, 1)[0]!;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  return path.slice(0, MAX_PATH);
}

const UNTRACKED = ["/admin", "/api", "/_next", "/avatar"];

/** The admin page (it refreshes itself), API calls and assets aren't page views. */
export function shouldTrackPath(path: string): boolean {
  return !UNTRACKED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** The other website a visitor came from (e.g. "google.com"), or null for direct visits and our own pages. */
export function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = bareHost(new URL(referrer).hostname);
    return host && host !== bareHost(ownHost) ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

export type TrafficBucket = { bucket: string; views: number; visitors: number };

/** Every bucket in order, zero where nothing was recorded. */
export function fillBuckets(buckets: string[], rows: TrafficBucket[]): TrafficBucket[] {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  return buckets.map((bucket) => byBucket.get(bucket) ?? { bucket, views: 0, visitors: 0 });
}

/** "YYYY-MM-DD HH" of an instant in a time zone (24-hour clock). */
export function hourKey(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}`;
}

/** The last `hours` clock hours ending with the current one, oldest first. */
export function lastHours(now: Date, hours: number, timeZone: string): string[] {
  const keys: string[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const key = hourKey(new Date(now.getTime() - i * 3_600_000), timeZone);
    if (keys.at(-1) !== key) keys.push(key);
  }
  return keys;
}
