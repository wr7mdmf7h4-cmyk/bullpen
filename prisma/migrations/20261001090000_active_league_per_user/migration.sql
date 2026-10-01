-- Remember the league each user is looking at on their account rather than
-- in a browser cookie (a cookie is shared by everyone using that browser and
-- lost on a new device). Purely additive: no existing data changes.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeLeagueId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeLeagueId_fkey" FOREIGN KEY ("activeLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
