/** League rules: pure functions, no I/O. */

export type LeagueKindName = "GLOBAL" | "PRIVATE";

export const DEFAULT_STARTING_CASH_CENTS = 1_000_000; // $10,000
export const DEFAULT_FEE_FLAT_CENTS = 100; // $1.00
export const DEFAULT_FEE_BPS = 10; // 0.10%

/** The Global league has a fixed id so it can be upserted idempotently. */
export const SYSTEM_LEAGUES = {
  global: {
    id: "global",
    kind: "GLOBAL" as const,
    name: "Global League",
  },
};

export const SYSTEM_LEAGUE_START = new Date("2026-01-01T00:00:00Z");

export type LeagueTiming = { startsAt: Date; endsAt: Date | null };
export type LeagueStatus = "UPCOMING" | "ACTIVE" | "ENDED";

export function leagueStatus(league: LeagueTiming, now: Date): LeagueStatus {
  if (now < league.startsAt) return "UPCOMING";
  if (league.endsAt && now >= league.endsAt) return "ENDED";
  return "ACTIVE";
}

// No 0/O/1/I/L to avoid ambiguity when codes are read out loud.
export const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 8;

/** Builds an invite code from random bytes (caller supplies the randomness). */
export function inviteCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < INVITE_CODE_LENGTH) throw new RangeError("need more random bytes");
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  }
  return code;
}

/** Human-friendly "3d 4h" style duration, used for countdowns. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
