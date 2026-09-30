import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { env } from "./env";

/**
 * Rate limiting with one interface and two backends:
 * - Upstash Redis (sliding window) when UPSTASH_* is configured — correct
 *   across many serverless instances.
 * - An in-memory fixed window otherwise — fine for local dev / a single
 *   instance, and keeps the app runnable with zero extra services.
 */

type Rule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  trade: { limit: 10, windowSeconds: 10 },
  auth: { limit: 10, windowSeconds: 60 },
  signup: { limit: 5, windowSeconds: 600 },
  demo: { limit: 20, windowSeconds: 60 },
  leagueWrite: { limit: 10, windowSeconds: 600 },
} satisfies Record<string, Rule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, rule: Rule): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return { ok: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > rule.limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

const upstash = new Map<RateLimitName, Ratelimit>();

function upstashLimiter(name: RateLimitName): Ratelimit | undefined {
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) return undefined;
  let limiter = upstash.get(name);
  if (!limiter) {
    const rule = RATE_LIMITS[name];
    limiter = new Ratelimit({
      redis: new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
      prefix: `bullpen:rl:${name}`,
    });
    upstash.set(name, limiter);
  }
  return limiter;
}

export async function rateLimit(name: RateLimitName, identifier: string): Promise<RateLimitResult> {
  const limiter = upstashLimiter(name);
  if (limiter) {
    try {
      const res = await limiter.limit(identifier);
      return { ok: res.success, retryAfterSeconds: Math.max(0, Math.ceil((res.reset - Date.now()) / 1000)) };
    } catch (err) {
      // Fail open to the in-memory limiter rather than taking the app down.
      console.error("[rate-limit] Upstash unavailable, using in-memory fallback", err);
    }
  }
  return memoryLimit(`${name}:${identifier}`, RATE_LIMITS[name]);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
