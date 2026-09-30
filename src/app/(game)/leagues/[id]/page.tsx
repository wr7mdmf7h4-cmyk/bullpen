import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteLink } from "@/components/league/invite-link";
import { LeagueLive } from "@/components/league/league-live";
import { LeagueStatusBadge } from "@/components/league/league-status";
import { LeaveLeagueButton } from "@/components/league/leave-league-button";
import { describeFees } from "@/domain/fees";
import { formatCents } from "@/domain/money";
import { features } from "@/server/env";
import { getActivity, getLeaderboard } from "@/server/leaderboard";
import { getLeagueForMember } from "@/server/leagues/service";
import { requireUser } from "@/server/users";

export const metadata: Metadata = { title: "League" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function LeaguePage({ params }: PageProps<"/leagues/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const membership = await getLeagueForMember(id, user.id);
  if (!membership) notFound();
  const { league } = membership;
  const now = new Date();
  const [leaderboard, activity] = await Promise.all([getLeaderboard(league.id, now), getActivity(league.id)]);

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <LeagueStatusBadge league={league} now={now} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{league.name}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div>
            <dt className="inline">Starting cash </dt>
            <dd className="num inline text-foreground">{formatCents(league.startingCashCents)}</dd>
          </div>
          <div>
            <dt className="inline">Fees </dt>
            <dd className="inline text-foreground">
              {describeFees({ flatCents: league.feeFlatCents, bps: league.feeBps })}
            </dd>
          </div>
          <div>
            <dt className="inline">Players </dt>
            <dd className="inline text-foreground">{league._count.portfolios}</dd>
          </div>
          {league.kind === "PRIVATE" && (
            <div>
              <dt className="inline">Runs </dt>
              <dd className="inline text-foreground">
                {dateFmt.format(league.startsAt)} – {league.endsAt ? dateFmt.format(league.endsAt) : "∞"}
              </dd>
            </div>
          )}
          {league.owner?.username && (
            <div>
              <dt className="inline">Host </dt>
              <dd className="inline text-foreground">@{league.owner.username}</dd>
            </div>
          )}
        </dl>
        {league.kind === "PRIVATE" && (
          <div className="flex flex-wrap items-center gap-3">
            {league.inviteCode && (
              <div className="w-full max-w-md">
                <InviteLink code={league.inviteCode} />
              </div>
            )}
            <LeaveLeagueButton leagueId={league.id} leagueName={league.name} isOwner={league.ownerId === user.id} />
          </div>
        )}
      </header>

      <LeagueLive leagueId={league.id} meId={user.id} initial={{ leaderboard, activity }} mode={features().realtime} />
    </div>
  );
}
