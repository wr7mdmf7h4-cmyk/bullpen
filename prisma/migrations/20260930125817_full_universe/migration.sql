-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "basePriceCents" INTEGER,
ADD COLUMN     "isEtf" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "volBps" INTEGER,
ALTER COLUMN "sector" SET DEFAULT 'Unknown';

-- CreateIndex
CREATE INDEX "Instrument_isPopular_idx" ON "Instrument"("isPopular");
