import { z } from "zod";
import { ACCENTS, AVATAR_STYLES, BIO_MAX, DISPLAY_NAME_MAX, type AccentId, type AvatarStyle } from "@/domain/profile";

/** Shared Zod schemas: used by Server Actions and by forms for inline errors. */

const RESERVED = new Set(["admin", "demo", "bullpen", "support", "root", "system", "api", "me", "settings"]);

/** Shape of any existing username (used to look users up, e.g. /u/demo). */
export const usernameLookupSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Letters, numbers and underscores only");

/** Rules for *choosing* a username: same shape, minus reserved names. */
export const usernameSchema = usernameLookupSchema.refine((u) => !RESERVED.has(u), "That username is reserved");

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
  .regex(/^[A-Z]{1,5}(\.[A-Z])?$/, "Invalid ticker");

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

export const leagueNameSchema = z.string().trim().min(3, "At least 3 characters").max(40, "At most 40 characters");

export const createLeagueSchema = z
  .object({
    name: leagueNameSchema,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    startingCashDollars: z.coerce.number().int().min(1_000, "At least $1,000").max(1_000_000, "At most $1,000,000"),
    feeFlatCents: z.coerce.number().int().min(0).max(10_000, "Flat fee at most $100"),
    feeBps: z.coerce.number().int().min(0).max(500, "Fee at most 5%"),
    portfolioMode: z.enum(["SEPARATE", "LINKED"]).default("SEPARATE"),
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

// Strip control characters (zero-width tricks, bells…) from text other players see.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const cleanText = (v: string) =>
  v
    .replace(CONTROL_CHARS, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const bioSchema = z
  .string()
  .transform(cleanText)
  .pipe(z.string().max(BIO_MAX, `At most ${BIO_MAX} characters`));

const emptyToNull = (v: string) => (v === "" ? null : v);

export const profileSchema = z.object({
  displayName: z
    .string()
    .transform((v) => cleanText(v).replace(/\s+/g, " "))
    .pipe(z.string().max(DISPLAY_NAME_MAX, `At most ${DISPLAY_NAME_MAX} characters`))
    .transform(emptyToNull),
  bio: bioSchema.transform(emptyToNull),
  avatarStyle: z.enum(AVATAR_STYLES.map((s) => s.id) as [AvatarStyle, ...AvatarStyle[]]),
  avatarSeed: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid avatar"),
  accentColor: z
    .enum(ACCENTS.map((a) => a.id) as [AccentId, ...AccentId[]])
    .nullable()
    .catch(null),
  favoriteSymbol: z
    .string()
    .trim()
    .toUpperCase()
    .transform(emptyToNull)
    .pipe(
      z
        .string()
        .regex(/^[A-Z]{1,5}(\.[A-Z])?$/, "Enter a ticker like NVDA")
        .nullable(),
    ),
  featuredBadge: z.string().max(40).nullable(),
});

export type ProfileInput = z.input<typeof profileSchema>;

export type FieldErrors = Partial<Record<string, string[]>>;

/** Standard result shape returned by every Server Action. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: FieldErrors };
