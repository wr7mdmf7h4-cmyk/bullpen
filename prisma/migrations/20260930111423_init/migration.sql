-- CreateEnum
CREATE TYPE "LeagueKind" AS ENUM ('GLOBAL', 'PRACTICE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MarketSource" AS ENUM ('LIVE', 'SIMULATED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TRADE', 'ACHIEVEMENT', 'JOINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "avatarSeed" TEXT NOT NULL,
    "bio" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "kind" "LeagueKind" NOT NULL DEFAULT 'PRIVATE',
    "marketSource" "MarketSource" NOT NULL DEFAULT 'LIVE',
    "name" TEXT NOT NULL,
    "inviteCode" TEXT,
    "ownerId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "startingCashCents" INTEGER NOT NULL DEFAULT 1000000,
    "feeFlatCents" INTEGER NOT NULL DEFAULT 100,
    "feeBps" INTEGER NOT NULL DEFAULT 10,
    "maxMembers" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "cashCents" INTEGER NOT NULL,
    "realizedPnlCents" INTEGER NOT NULL DEFAULT 0,
    "feesPaidCents" INTEGER NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costBasisCents" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "netCashCents" INTEGER NOT NULL,
    "realizedPnlCents" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "totalValueCents" INTEGER NOT NULL,
    "cashCents" INTEGER NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "QuoteCache" (
    "symbol" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "prevCloseCents" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteCache_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementKey")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE INDEX "League_kind_idx" ON "League"("kind");

-- CreateIndex
CREATE INDEX "Portfolio_leagueId_idx" ON "Portfolio"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_leagueId_key" ON "Portfolio"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_portfolioId_symbol_key" ON "Holding"("portfolioId", "symbol");

-- CreateIndex
CREATE INDEX "Trade_portfolioId_executedAt_idx" ON "Trade"("portfolioId", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_portfolioId_idempotencyKey_key" ON "Trade"("portfolioId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_portfolioId_takenAt_key" ON "PortfolioSnapshot"("portfolioId", "takenAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_leagueId_createdAt_idx" ON "ActivityEvent"("leagueId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Instrument"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
