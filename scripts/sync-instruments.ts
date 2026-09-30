/**
 * Loads every US-listed stock and ETF into the Instrument table.
 *
 *   npm run instruments:sync
 *
 * Safe to re-run: upserts new symbols, refreshes names, keeps sectors, marks
 * delisted symbols inactive. The daily cron also re-runs it weekly.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncInstruments } from "../src/lib/instrument-sync";

const url =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (or DIRECT_URL) first");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const started = Date.now();
syncInstruments(db, { log: (m) => console.log(`  ${m}`) })
  .then(({ symbols, delisted }) => {
    console.log(
      `✅ ${symbols} tradable symbols synced (${delisted} delisted) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  })
  .catch((err) => {
    console.error("❌ Instrument sync failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
