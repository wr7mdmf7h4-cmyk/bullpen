import "server-only";
import { db } from "./db";
import { POPULAR } from "@/domain/market/universe";
import {
  DEFAULT_FEE_BPS,
  DEFAULT_FEE_FLAT_CENTS,
  DEFAULT_STARTING_CASH_CENTS,
  SYSTEM_LEAGUES,
  SYSTEM_LEAGUE_START,
} from "@/domain/leagues";

/**
 * Makes sure the popular instruments and the Global league exist.
 * Idempotent and memoised per process, so a fresh database works without the
 * seed or a full instrument sync (you just get the popular list until then).
 */
let ready: Promise<void> | undefined;

export function ensureReferenceData(): Promise<void> {
  ready ??= (async () => {
    const popularCount = await db.instrument.count({ where: { isPopular: true } });
    if (popularCount < POPULAR.length) {
      for (const p of POPULAR) {
        const data = {
          name: p.name,
          sector: p.sector,
          exchange: p.exchange,
          isEtf: p.sector === "ETF",
          isPopular: true,
        };
        await db.instrument.upsert({
          where: { symbol: p.symbol },
          create: { symbol: p.symbol, ...data },
          update: data,
        });
      }
    }
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
