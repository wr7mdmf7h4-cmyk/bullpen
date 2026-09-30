-- CreateTable
CREATE TABLE "HistoryBackfill" (
    "symbol" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoryBackfill_pkey" PRIMARY KEY ("symbol","resolution")
);

