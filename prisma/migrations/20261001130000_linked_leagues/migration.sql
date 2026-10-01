-- Leagues can link to everyone's main portfolio instead of handing out a
-- fresh one. Existing leagues keep separate portfolios.

-- CreateEnum
CREATE TYPE "PortfolioMode" AS ENUM ('SEPARATE', 'LINKED');

-- AlterTable
ALTER TABLE "League" ADD COLUMN "portfolioMode" "PortfolioMode" NOT NULL DEFAULT 'SEPARATE';

-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN "baselineCents" INTEGER;

ALTER TABLE "Portfolio" ADD CONSTRAINT "portfolio_baseline_positive" CHECK ("baselineCents" IS NULL OR "baselineCents" > 0);
