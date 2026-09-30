import "server-only";
import { db } from "./db";
import { UNIVERSE } from "@/domain/market/universe";
import {
  DEFAULT_FEE_BPS,
  DEFAULT_FEE_FLAT_CENTS,
  DEFAULT_STARTING_CASH_CENTS,
  SYSTEM_LEAGUES,
  SYSTEM_LEAGUE_START,
} from "@/domain/leagues";

/**
 * Makes sure instruments and the two system leagues exist. Idempotent and
 * memoised per process, so a fresh database works without running the seed.
 */
let ready: Promise<void> | undefined;

export function ensureReferenceData(): Promise<void> {
  ready ??= (async () => {
    await db.instrument.createMany({
      data: UNIVERSE.map(({ symbol, name, sector, exchange }) => ({ symbol, name, sector, exchange })),
      skipDuplicates: true,
    });
    for (const league of Object.values(SYSTEM_LEAGUES)) {
      await db.league.upsert({
        where: { id: league.id },
        update: {},
        create: {
          ...league,
          startsAt: SYSTEM_LEAGUE_START,
          endsAt: null,
          startingCashCents: DEFAULT_STARTING_CASH_CENTS,
          feeFlatCents: DEFAULT_FEE_FLAT_CENTS,
          feeBps: DEFAULT_FEE_BPS,
          maxMembers: 1_000_000,
        },
      });
    }
  })().catch((err) => {
    ready = undefined; // retry on next call
    throw err;
  });
  return ready;
}
