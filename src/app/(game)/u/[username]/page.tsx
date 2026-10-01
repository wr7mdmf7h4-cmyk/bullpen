import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { AchievementGrid } from "@/components/achievements/achievement-grid";
import { RankBadge } from "@/components/portfolio/rank-badge";
import { TradeHistory } from "@/components/trade/trade-history";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { toneClass } from "@/components/market/delta";
import { ACHIEVEMENTS } from "@/domain/achievements";
import { formatBps, formatCents } from "@/domain/money";
import { accentColor } from "@/domain/profile";
import { usernameLookupSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { getLeaderboard } from "@/server/leaderboard";
import { requireUser } from "@/server/users";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  return { title: `@${(await params).username}` };
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const viewer = await requireUser();
  const parsed = usernameLookupSchema.safeParse(decodeURIComponent((await params).username));
  if (!parsed.success) notFound();
  const user = await db.user.findUnique({
    where: { username: parsed.data },
    include: {
      achievements: true,
      portfolios: { include: { league: true }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!user) notFound();

  const now = new Date();
  const [boards, trades] = await Promise.all([
    Promise.all(user.portfolios.map((p) => getLeaderboard(p.leagueId, now))),
    db.trade.findMany({
      where: { portfolio: { userId: user.id } },
      orderBy: { executedAt: "desc" },
      take: 20,
      include: { portfolio: { select: { league: { select: { name: true } } } } },
    }),
  ]);

  const standings = user.portfolios.map((p, i) => ({
    portfolio: p,
    row: boards[i]!.find((r) => r.userId === user.id),
    players: boards[i]!.length,
  }));
  const bestReturn = Math.max(...standings.map((s) => s.row?.returnBps ?? Number.MIN_SAFE_INTEGER));
  const totals = user.portfolios.reduce(
    (acc, p) => ({
      trades: acc.trades + p.tradeCount,
      fees: acc.fees + p.feesPaidCents,
      realized: acc.realized + p.realizedPnlCents,
    }),
    { trades: 0, fees: 0, realized: 0 },
  );
  const unlocked = new Map(user.achievements.map((a) => [a.achievementKey, a.unlockedAt]));
  const isMe = viewer.id === user.id;
  const accent = accentColor(user.accentColor);
  const featured = unlocked.has(user.featuredBadge ?? "")
    ? ACHIEVEMENTS.find((a) => a.key === user.featuredBadge)
    : undefined;
  const favorite = user.favoriteSymbol;

  return (
    <div className="grid gap-10">
      <header className="surface relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{
            background: `linear-gradient(100deg, ${accent ?? "var(--primary)"}, transparent 75%)`,
            opacity: accent ? 0.55 : 0.12,
          }}
        />
        <div className="relative flex flex-wrap items-end gap-5 pt-8">
          <UserAvatar seed={user.avatarSeed} name={user.username} className="size-20 ring-4 ring-surface" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-3xl font-semibold tracking-tight">
                {user.displayName ?? `@${user.username}`}
              </h1>
              {Number.isFinite(bestReturn) && bestReturn > Number.MIN_SAFE_INTEGER && (
                <RankBadge returnBps={bestReturn} />
              )}
              {isMe && <span className="rounded bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">YOU</span>}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {user.displayName && <span className="text-foreground/80">@{user.username}</span>}
              {user.displayName && <span aria-hidden>·</span>}
              <span>
                Trading since {monthFmt.format(user.createdAt)} · {unlocked.size}/{ACHIEVEMENTS.length} badges
              </span>
            </p>
          </div>
          {isMe && (
            <Button asChild variant="secondary" size="sm" className="rounded-full">
              <Link href="/profile/edit">
                <Pencil /> Edit profile
              </Link>
            </Button>
          )}
        </div>
        {(user.bio || featured || favorite) && (
          <div className="relative mt-4 grid gap-3">
            {user.bio && <p className="max-w-prose text-sm whitespace-pre-line">{user.bio}</p>}
            {(featured || favorite) && (
              <div className="flex flex-wrap gap-2 text-sm">
                {featured && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/40 px-3 py-1">
                    <span aria-hidden>{featured.emoji}</span> {featured.name}
                  </span>
                )}
                {favorite && (
                  <Link
                    href={`/stocks/${favorite}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background/40 px-3 py-1 hover:border-primary/60"
                  >
                    <span className="text-muted-foreground">Favourite</span>
                    <span className="font-mono font-semibold">{favorite}</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Trades" value={totals.trades.toLocaleString("en-US")} />
        <Stat
          label="Realised P&L"
          value={formatCents(totals.realized, { sign: true })}
          className={toneClass(totals.realized)}
        />
        <Stat label="Fees paid" value={formatCents(totals.fees)} />
        <Stat label="Leagues" value={String(user.portfolios.length)} />
      </div>

      <section className="grid gap-3" aria-labelledby="leagues">
        <h2 id="leagues" className="text-lg font-semibold">
          Standings
        </h2>
        <ul className="surface divide-y overflow-hidden">
          {standings.map(({ portfolio, row, players }) => (
            <li key={portfolio.id}>
              <Link
                href={`/leagues/${portfolio.leagueId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <span className="num w-10 text-sm font-semibold text-muted-foreground">#{row?.rank ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{portfolio.league.name}</span>
                  <span className="block text-xs text-muted-foreground">of {players} players</span>
                </span>
                {row && (
                  <span
                    className={cn(
                      "num text-sm font-semibold",
                      row.returnBps > 0 ? "text-gain" : row.returnBps < 0 ? "text-loss" : "text-muted-foreground",
                    )}
                  >
                    {formatBps(row.returnBps, { sign: true })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3" aria-labelledby="achievements">
        <h2 id="achievements" className="text-lg font-semibold">
          Achievements
        </h2>
        <AchievementGrid unlocked={unlocked} />
      </section>

      <section className="grid gap-3" aria-labelledby="trades">
        <h2 id="trades" className="text-lg font-semibold">
          Recent trades
        </h2>
        <TradeHistory
          trades={trades.map((t) => ({ ...t, leagueName: t.portfolio.league.name }))}
          emptyText={isMe ? "No trades yet. Go make some money (or lose it)!" : "No trades yet."}
        />
      </section>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="surface grid gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("num text-lg font-semibold", className)}>{value}</span>
    </div>
  );
}
