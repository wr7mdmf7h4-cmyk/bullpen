import type { PrismaClient } from "@/generated/prisma/client";
import { buildUniverse } from "@/domain/market/symbol-directory";
import { POPULAR } from "@/domain/market/universe";

/**
 * Syncs the Instrument table with the NASDAQ Trader symbol directory.
 * Shared by the CLI (`npm run instruments:sync`) and the weekly cron, so it
 * takes the Prisma client as a parameter and has no Next.js imports.
 *
 * - new symbols are inserted, names/exchanges refreshed, sectors preserved
 * - symbols that vanished from the directory are marked inactive (delisted);
 *   existing holdings keep their last price but can no longer be traded
 * - the hand-picked popular list is (re)applied with its tuned parameters
 */
export const DIRECTORY_URLS = {
  nasdaq: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
  other: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
};

async function download(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

export async function syncInstruments(db: PrismaClient, opts: { log?: (msg: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const [nasdaq, other] = await Promise.all([download(DIRECTORY_URLS.nasdaq), download(DIRECTORY_URLS.other)]);
  const entries = buildUniverse(nasdaq, other);
  // Guard against a truncated or changed file wiping the universe.
  if (entries.length < 5_000) throw new Error(`Directory looks incomplete (${entries.length} symbols); aborting`);
  log(`Parsed ${entries.length} tradable symbols`);

  const now = new Date();
  const BATCH = 1_000;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const values = batch.map((_, j) => {
      const o = j * 5;
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, CASE WHEN $${o + 4} THEN 'ETF' ELSE 'Unknown' END, true, $${o + 5})`;
    });
    const params = batch.flatMap((e) => [e.symbol, e.name, e.exchange, e.isEtf, now]);
    await db.$executeRawUnsafe(
      `INSERT INTO "Instrument" ("symbol", "name", "exchange", "isEtf", "sector", "isActive", "syncedAt")
       VALUES ${values.join(", ")}
       ON CONFLICT ("symbol") DO UPDATE SET
         "exchange" = EXCLUDED."exchange",
         "isEtf" = EXCLUDED."isEtf",
         "isActive" = true,
         "syncedAt" = EXCLUDED."syncedAt",
         "name" = CASE WHEN "Instrument"."isPopular" THEN "Instrument"."name" ELSE EXCLUDED."name" END,
         "sector" = CASE WHEN "Instrument"."sector" = 'Unknown' THEN EXCLUDED."sector" ELSE "Instrument"."sector" END`,
      ...params,
    );
    log(`Upserted ${Math.min(i + BATCH, entries.length)}/${entries.length}`);
  }

  const delisted = await db.instrument.updateMany({
    where: { OR: [{ syncedAt: { lt: now } }, { syncedAt: null }], isActive: true, isPopular: false },
    data: { isActive: false },
  });
  log(`Marked ${delisted.count} delisted symbols inactive`);

  for (const p of POPULAR) {
    await db.instrument
      .update({
        where: { symbol: p.symbol },
        data: { isPopular: true, name: p.name, sector: p.sector },
      })
      .catch(() => undefined); // a popular symbol missing from the directory is left as-is
  }

  return { symbols: entries.length, delisted: delisted.count };
}

/** When the universe was last synced (null if never). */
export async function lastSyncedAt(db: PrismaClient): Promise<Date | null> {
  const row = await db.instrument.aggregate({ _max: { syncedAt: true } });
  return row._max.syncedAt;
}
