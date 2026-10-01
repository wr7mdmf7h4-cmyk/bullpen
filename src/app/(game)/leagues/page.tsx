import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Globe, Users } from "lucide-react";
import { CreateLeagueDialog, JoinLeagueForm } from "@/components/league/league-forms";
import { LeagueStatusBadge } from "@/components/league/league-status";
import { formatBps } from "@/domain/money";
import { getLeaderboard } from "@/server/leaderboard";
import { listMyLeagues } from "@/server/leagues/service";
import { requireUser } from "@/server/users";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leagues" };

const ICONS = { GLOBAL: Globe, PRIVATE: Users };

export default async function LeaguesPage({ searchParams }: PageProps<"/leagues">) {
  const user = await requireUser();
  const { left } = await searchParams;
  const now = new Date();
  const mine = await listMyLeagues(user.id);
  const boards = await Promise.all(mine.map((p) => getLeaderboard(p.leagueId, now)));

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leagues</h1>
          <p className="text-sm text-muted-foreground">Compete with friends. Everyone starts equal; returns decide.</p>
        </div>
        <CreateLeagueDialog />
      </header>

      {left && (
        <p role="status" className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          You left the league. Your portfolio there has been removed.
        </p>
      )}

      <section className="surface grid gap-3 p-4 sm:grid-cols-[1fr_minmax(0,22rem)] sm:items-center">
        <div>
          <h2 className="font-semibold">Got an invite code?</h2>
          <p className="text-sm text-muted-foreground">Join a friend&apos;s league and get a fresh portfolio.</p>
        </div>
        <JoinLeagueForm />
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {mine.map((p, i) => {
          const Icon = ICONS[p.league.kind];
          const me = boards[i]!.find((r) => r.userId === user.id);
          return (
            <li key={p.id}>
              <Link
                href={`/leagues/${p.leagueId}`}
                className="surface group grid gap-4 p-5 transition-colors hover:border-primary/30 hover:bg-accent/30"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{p.league.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <LeagueStatusBadge league={p.league} now={now} />
                      {p.league.portfolioMode === "LINKED" && (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          Main portfolio
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Your rank" value={me ? `#${me.rank}` : "—"} />
                  <Mini
                    label="Return"
                    value={me ? formatBps(me.returnBps, { sign: true }) : "—"}
                    className={me && me.returnBps > 0 ? "text-gain" : me && me.returnBps < 0 ? "text-loss" : undefined}
                  />
                  <Mini label="Players" value={String(p.league._count.portfolios)} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-background/40 py-2">
      <div className={cn("num text-base font-semibold", className)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
