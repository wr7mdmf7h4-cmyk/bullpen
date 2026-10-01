import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { ADMIN_TIME_ZONE, dayKey, lastDays } from "@/domain/admin";
import {
  deviceType,
  fillBuckets,
  isBot,
  lastHours,
  normalizePath,
  referrerHost,
  shouldTrackPath,
  type TrafficBucket,
} from "@/domain/analytics";

const DAY_MS = 86_400_000;
export const TRAFFIC_RETENTION_DAYS = 90;

/**
 * Anonymous visitor id: a hash of IP + browser + the app secret + today's
 * date. It's stable for a day (so we can count unique visitors) and then
 * changes, and the IP itself is never stored.
 */
function visitorHash(ip: string, userAgent: string, now: Date) {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${env().AUTH_SECRET}|${day}|${ip}|${userAgent}`).digest("base64url").slice(0, 22);
}

export async function recordPageView(input: {
  path: string;
  referrer: string;
  userAgent: string;
  ip: string;
  host: string;
  country: string | null;
  userId: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const path = normalizePath(input.path);
  if (!path || !shouldTrackPath(path) || isBot(input.userAgent)) return false;
  await db.pageView.create({
    data: {
      createdAt: now,
      path,
      visitorHash: visitorHash(input.ip, input.userAgent, now),
      userId: input.userId,
      referrer: referrerHost(input.referrer, input.host),
      country: input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null,
      device: deviceType(input.userAgent),
    },
  });
  return true;
}

/** Daily cron: keep traffic data for 90 days only. */
export async function pruneOldPageViews(now = new Date()) {
  const { count } = await db.pageView.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - TRAFFIC_RETENTION_DAYS * DAY_MS) } },
  });
  return count;
}

type CountRow = { label: string | null; views: bigint; visitors: bigint };
const toCounts = (rows: CountRow[]) =>
  rows.map((r) => ({ label: r.label, views: Number(r.views), visitors: Number(r.visitors) }));

/** Everything the admin "Site traffic" section shows. */
export async function getTrafficStats(now = new Date()) {
  const tz = ADMIN_TIME_ZONE;
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const since30d = ago(31 * DAY_MS);
  // createdAt is stored as UTC; convert to UK time for day/hour buckets.
  const local = `(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE '${tz}')`;

  const [totals, daily, hourly, pages, referrers, countries, devices, recent] = await Promise.all([
    db.$queryRawUnsafe<
      { views24h: bigint; visitors24h: bigint; views7d: bigint; visitors7d: bigint; views30d: bigint }[]
    >(
      `SELECT count(*) FILTER (WHERE "createdAt" >= $1) AS "views24h",
              count(DISTINCT "visitorHash") FILTER (WHERE "createdAt" >= $1) AS "visitors24h",
              count(*) FILTER (WHERE "createdAt" >= $2) AS "views7d",
              count(DISTINCT "visitorHash") FILTER (WHERE "createdAt" >= $2) AS "visitors7d",
              count(*) FILTER (WHERE "createdAt" >= $3) AS "views30d"
         FROM "PageView" WHERE "createdAt" >= $3`,
      ago(DAY_MS),
      ago(7 * DAY_MS),
      ago(30 * DAY_MS),
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT to_char(${local}, 'YYYY-MM-DD') AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1`,
      since30d,
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT to_char(${local}, 'YYYY-MM-DD HH24') AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1`,
      ago(25 * 3_600_000),
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT path AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
      ago(7 * DAY_MS),
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT referrer AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 AND referrer IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      ago(30 * DAY_MS),
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT country AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 3 DESC LIMIT 8`,
      ago(30 * DAY_MS),
    ),
    db.$queryRawUnsafe<CountRow[]>(
      `SELECT device AS label, count(*) AS views, count(DISTINCT "visitorHash") AS visitors
         FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 3 DESC`,
      ago(30 * DAY_MS),
    ),
    db.pageView.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        path: true,
        visitorHash: true,
        referrer: true,
        country: true,
        device: true,
        user: { select: { username: true } },
      },
    }),
  ]);

  const t = totals[0];
  const asBuckets = (rows: CountRow[]): TrafficBucket[] =>
    toCounts(rows).map((r) => ({ bucket: r.label ?? "", views: r.views, visitors: r.visitors }));

  return {
    totals: {
      views24h: Number(t?.views24h ?? 0),
      visitors24h: Number(t?.visitors24h ?? 0),
      views7d: Number(t?.views7d ?? 0),
      visitors7d: Number(t?.visitors7d ?? 0),
      views30d: Number(t?.views30d ?? 0),
    },
    daily: fillBuckets(lastDays(now, 30, tz), asBuckets(daily)),
    hourly: fillBuckets(lastHours(now, 24, tz), asBuckets(hourly)),
    today: dayKey(now, tz),
    pages: toCounts(pages),
    referrers: toCounts(referrers),
    countries: toCounts(countries),
    devices: toCounts(devices),
    recent: recent.map((v) => ({
      id: v.id,
      at: v.createdAt,
      path: v.path,
      visitor: v.user?.username
        ? { kind: "user" as const, username: v.user.username }
        : { kind: "guest" as const, tag: v.visitorHash.slice(0, 5) },
      referrer: v.referrer,
      country: v.country,
      device: v.device,
    })),
  };
}

export type TrafficStats = Awaited<ReturnType<typeof getTrafficStats>>;
