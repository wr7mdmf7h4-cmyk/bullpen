import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { JoinButton } from "@/components/league/join-button";
import { LeagueStatusBadge } from "@/components/league/league-status";
import { describeFees } from "@/domain/fees";
import { formatCents } from "@/domain/money";
import { inviteCodeSchema } from "@/lib/validators";
import { db } from "@/server/db";
import { findLeagueByInvite } from "@/server/leagues/service";
import { requireUser } from "@/server/users";

export const metadata: Metadata = { title: "Join league" };

/**
 * Lives outside the (game) route group so a logged-out visitor is sent to
 * /login?next=/join/CODE and lands back here after signing in or up.
 */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const user = await requireUser(`/join/${code}`);
  const parsed = inviteCodeSchema.safeParse(code);
  const league = parsed.success ? await findLeagueByInvite(parsed.data) : null;

  if (!league) {
    return (
      <Shell>
        <div className="surface grid max-w-md gap-2 p-8 text-center">
          <p className="text-3xl">🤔</p>
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="text-sm text-muted-foreground">Double-check the link or ask your friend for a new one.</p>
        </div>
      </Shell>
    );
  }

  const member = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
    select: { id: true },
  });
  if (member) redirect(`/leagues/${league.id}`);
  const now = new Date();

  return (
    <Shell>
      <div className="surface grid w-full max-w-md gap-5 p-8 text-center">
        <p className="text-4xl">🏟️</p>
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">
            {league.owner?.username ? `@${league.owner.username} invited you to` : "You're invited to"}
          </p>
          <h1 className="text-2xl font-semibold">{league.name}</h1>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <LeagueStatusBadge league={league} now={now} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div className="grid gap-0.5 rounded-xl bg-background/40 p-2">
            <dd className="num font-semibold">{formatCents(league.startingCashCents)}</dd>
            <dt className="text-xs text-muted-foreground">Starting cash</dt>
          </div>
          <div className="grid gap-0.5 rounded-xl bg-background/40 p-2">
            <dd className="font-semibold">{league._count.portfolios}</dd>
            <dt className="text-xs text-muted-foreground">Players</dt>
          </div>
          <div className="grid gap-0.5 rounded-xl bg-background/40 p-2">
            <dd className="text-xs font-semibold">
              {describeFees({ flatCents: league.feeFlatCents, bps: league.feeBps })}
            </dd>
            <dt className="text-xs text-muted-foreground">Fees</dt>
          </div>
        </dl>
        <JoinButton code={league.inviteCode!} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4">
      <header className="mx-auto w-full max-w-6xl py-5 sm:px-2">
        <Logo href="/dashboard" />
      </header>
      <main className="grid flex-1 place-items-center pb-16">{children}</main>
    </div>
  );
}
