-- Real market data only.
-- The simulated market, the 24/7 Practice league, the bot traders and the
-- generated demo world are removed. Real users keep their Global League and
-- private-league portfolios; private leagues that used the simulated market
-- now follow the real one.

-- 1. Generated data (cascades to portfolios, trades, holdings, snapshots,
--    achievements and activity of those users/leagues).
DELETE FROM "User" WHERE "email" = 'demo@bullpen.dev' OR "email" LIKE '%@bots.bullpen.dev';
DELETE FROM "League" WHERE "id" = 'practice' OR "kind" = 'PRACTICE' OR "inviteCode" = 'PAPERHND';

-- 2. Schema

-- AlterEnum
BEGIN;
CREATE TYPE "LeagueKind_new" AS ENUM ('GLOBAL', 'PRIVATE');
ALTER TABLE "public"."League" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "League" ALTER COLUMN "kind" TYPE "LeagueKind_new" USING ("kind"::text::"LeagueKind_new");
ALTER TYPE "LeagueKind" RENAME TO "LeagueKind_old";
ALTER TYPE "LeagueKind_new" RENAME TO "LeagueKind";
DROP TYPE "public"."LeagueKind_old";
ALTER TABLE "League" ALTER COLUMN "kind" SET DEFAULT 'PRIVATE';
COMMIT;

-- AlterTable
ALTER TABLE "Instrument" DROP COLUMN "basePriceCents",
DROP COLUMN "volBps";

-- AlterTable
ALTER TABLE "League" DROP COLUMN "marketSource";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isDemo";

-- DropTable
DROP TABLE "AppSetting";

-- DropEnum
DROP TYPE "MarketSource";

-- CreateTable
CREATE TABLE "PriceSample" (
    "symbol" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "PriceSample_pkey" PRIMARY KEY ("symbol","takenAt")
);

-- AddForeignKey
ALTER TABLE "PriceSample" ADD CONSTRAINT "PriceSample_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Instrument"("symbol") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PriceSample" ADD CONSTRAINT "price_sample_positive" CHECK ("priceCents" > 0);
