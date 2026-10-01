-- Profile customisation. Purely additive; existing profiles look the same.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT,
ADD COLUMN "accentColor" TEXT,
ADD COLUMN "favoriteSymbol" TEXT,
ADD COLUMN "featuredBadge" TEXT;
