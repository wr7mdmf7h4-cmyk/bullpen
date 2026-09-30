import { z } from "zod";

/** Shared Zod schemas: used by Server Actions and by forms for inline errors. */

const RESERVED = new Set(["admin", "demo", "bullpen", "support", "root", "system", "api", "me", "settings"]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Letters, numbers and underscores only")
  .refine((u) => !RESERVED.has(u), "That username is reserved");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(254));

export const passwordSchema = z.string().min(8, "At least 8 characters").max(128, "At most 128 characters");

export const signUpSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
});

export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z.]{1,6}$/, "Invalid ticker");

export const tradeSchema = z.object({
  leagueId: z.string().min(1).max(40),
  symbol: tickerSchema,
  side: z.enum(["BUY", "SELL"]),
  quantity: z.coerce
    .number()
    .int("Whole shares only")
    .min(1, "At least 1 share")
    .max(100_000, "Max 100,000 shares per order"),
  /** price the user saw when confirming; used as a slippage guard */
  expectedPriceCents: z.coerce.number().int().positive(),
  idempotencyKey: z.uuid(),
});

export const createLeagueSchema = z
  .object({
    name: z.string().trim().min(3, "At least 3 characters").max(40, "At most 40 characters"),
    marketSource: z.enum(["LIVE", "SIMULATED"]),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    startingCashDollars: z.coerce.number().int().min(1_000, "At least $1,000").max(1_000_000, "At most $1,000,000"),
    feeFlatCents: z.coerce.number().int().min(0).max(10_000, "Flat fee at most $100"),
    feeBps: z.coerce.number().int().min(0).max(500, "Fee at most 5%"),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((v) => v.endsAt.getTime() - v.startsAt.getTime() <= 366 * 86_400_000, {
    message: "Leagues can last at most a year",
    path: ["endsAt"],
  });

export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,10}$/, "Invalid invite code");

export const bioSchema = z.string().trim().max(160, "At most 160 characters");

export type FieldErrors = Partial<Record<string, string[]>>;

/** Standard result shape returned by every Server Action. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: FieldErrors };
