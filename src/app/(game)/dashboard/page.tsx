import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AchievementAnnouncer } from "@/components/achievements/achievement-announcer";
import { AchievementGrid } from "@/components/achievements/achievement-grid";
import { ActivityFeed } from "@/components/league/activity-feed";
import { LeaderboardList } from "@/components/league/leaderboard";
import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { ACHIEVEMENTS } from "@/domain/achievements";
import { evaluateAchievements } from "@/server/achievements";
import { db } from "@/server/db";
import { getActivity, getLeaderboard } from "@/server/leaderboard";
import { getActivePortfolio } from "@/server/leagues/active";
import { requireUser } from "@/server/users";
import { loadPortfolioOverview } from "@/server/views";

export const metadata: Metadata = { title: "Home" };

function greeting(now: Date) {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(now),
  );
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const now = new Date();
  const active = await getActivePortfolio(user.id);

  // Time-based badges (Diamond Hands) unlock on visit, not only on trade.
  const newlyUnlocked = await evaluateAchievements(user.id, now).catch(() => []);
  const [{ props }, leaderboard, activity, achievements] = await Promise.all([
    loadPortfolioOverview(active.id, now),
    getLeaderboard(active.leagueId, now),
    getActivity(active.leagueId, 8),
    db.userAchievement.findMany({ where: { userId: user.id } }),
  ]);
  const me = leaderboard.find((r) => r.userId === user.id);
  const unlocked = new Map(achievements.map((a) => [a.achievementKey, a.unlockedAt]));

  return (
    <div className="grid gap-10">
      <AchievementAnnouncer unlocked={newlyUnlocked} />

      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">{greeting(now)},</p>
        <h1 className="text-3xl font-semibold tracking-tight">@{user.username}</h1>
        {welcome && (
          <p className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm">
            🎉 Welcome to the pen! You have <strong>$10,000</strong> in the Global League (real US market hours) and
            another <strong>$10,000</strong> in 24/7 Practice. Switch leagues from the menu at the top.
          </p>
        )}
        {user.isDemo && (
          <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            You&apos;re on the shared demo account, so other visitors trade here too.{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Create your own account
            </Link>{" "}
            to keep your gains.
          </p>
        )}
      </header>

      <PortfolioOverview {...props} compact />

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="grid content-start gap-3" aria-labelledby="standings">
          <div className="flex items-center justify-between">
            <h2 id="standings" className="text-lg font-semibold">
              {me ? `You're #${me.rank} of ${leaderboard.length}` : "Standings"}
            </h2>
            <Link href={`/leagues/${active.leagueId}`} className="inline-flex items-center gap-1 text-sm text-primary">
              Full leaderboard <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <LeaderboardList rows={leaderboard} meId={user.id} limit={5} />
        </section>
        <section className="grid content-start gap-3" aria-labelledby="activity">
          <h2 id="activity" className="text-lg font-semibold">
            League activity
          </h2>
          <ActivityFeed items={activity} />
        </section>
      </div>

      <section className="grid gap-3" aria-labelledby="badges">
        <div className="flex items-center justify-between">
          <h2 id="badges" className="text-lg font-semibold">
            Achievements{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {unlocked.size}/{ACHIEVEMENTS.length}
            </span>
          </h2>
          <Link href={`/u/${user.username}`} className="inline-flex items-center gap-1 text-sm text-primary">
            All badges <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <AchievementGrid unlocked={unlocked} compact />
      </section>
    </div>
  );
}
