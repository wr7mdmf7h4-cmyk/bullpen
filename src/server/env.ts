import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once with Zod.
 *
 * Only DATABASE_URL and AUTH_SECRET are required. Every other integration is
 * optional and has a working fallback (see README → "Graceful fallbacks").
 */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  FINNHUB_API_KEY: optional,
  /** optional: real price history (Twelve Data free plan) */
  TWELVE_DATA_API_KEY: optional,
  ABLY_API_KEY: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  CRON_SECRET: optional,
  /** "1" = deterministic fake prices for local development/tests. Ignored in production. */
  FAKE_MARKET_DATA: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Which optional integrations are switched on. Safe to pass to the client. */
export function features() {
  const e = env();
  return {
    google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    liveQuotes: Boolean(e.FINNHUB_API_KEY),
    fakeMarketData: !e.FINNHUB_API_KEY && e.FAKE_MARKET_DATA === "1" && e.NODE_ENV !== "production",
    realtime: e.ABLY_API_KEY ? ("ably" as const) : ("polling" as const),
    distributedRateLimit: Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN),
  };
}
