import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { DeleteLeagueButton, RemovePlayerButton } from "@/components/admin/moderation-buttons";
import { SignupsChart } from "@/components/admin/signups-chart";
import { ADMIN_TIME_ZONE } from "@/domain/admin";
import { formatCents } from "@/domain/money";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CHART_DAYS, getAdminStats, LIST_LIMIT, requireAdmin } from "@/server/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const number = new Intl.NumberFormat("en-US");

function Stat({ label, value, detail }: { label: string; value: number; detail?: React.ReactNode }) {
  return (
    <div className="surface grid gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num text-2xl font-semibold">{number.format(value)}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="surface p-4 text-sm text-muted-foreground">{children}</p>;
}

function UserLink({ username }: { username: string | null }) {
  if (!username) return <span className="text-muted-foreground">(choosing a username)</span>;
  return (
    <Link href={`/u/${username}`} className="font-medium hover:text-primary">
      @{username}
    </Link>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin();
  const { q } = await searchParams;
  const stats = await getAdminStats({ query: typeof q === "string" ? q : "" });
  const now = stats.generatedAt.getTime();
  const { totals } = stats;
  const updatedAt = stats.generatedAt.toLocaleTimeString("en-GB", { timeZone: ADMIN_TIME_ZONE });

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Only you can see this page</p>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        </div>
        <LiveRefresh updatedAt={updatedAt} />
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Players" value={totals.users} detail={`${number.format(totals.usersWhoTraded)} have traded`} />
        <Stat
          label="Sign-ups, last 24h"
          value={totals.signups24h}
          detail={`${number.format(totals.signups7d)} this week · ${number.format(totals.signups30d)} in 30 days`}
        />
        <Stat
          label="Online now"
          value={totals.onlineNow}
          detail={`${number.format(totals.active24h)} today · ${number.format(totals.active7d)} this week`}
        />
        <Stat
          label="Trades, last 24h"
          value={totals.trades24h}
          detail={`${number.format(totals.trades)} all time · ${number.format(totals.privateLeagues)} private ${totals.privateLeagues === 1 ? "league" : "leagues"}`}
        />
      </div>

      <Section title="Sign-ups per day" aside={`Last ${CHART_DAYS} days, UK time`}>
        <div className="surface p-4">
          <SignupsChart data={stats.signupsByDay} />
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Online now" aside="Active in the last 10 minutes">
          {stats.onlineUsers.length ? (
            <ul className="surface divide-y">
              {stats.onlineUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <UserLink username={u.username} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {u.lastSeenAt ? timeAgo(u.lastSeenAt.getTime(), now) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nobody right now.</Empty>
          )}
        </Section>

        <Section title="Latest trades">
          {stats.recentTrades.length ? (
            <ul className="surface divide-y">
              {stats.recentTrades.map((t) => (
                <li key={t.id} className="grid gap-0.5 px-4 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      <UserLink username={t.username} />{" "}
                      <span className={cn("font-medium", t.side === "BUY" ? "text-gain" : "text-loss")}>
                        {t.side === "BUY" ? "bought" : "sold"}
                      </span>{" "}
                      <span className="num">{number.format(t.quantity)}</span>{" "}
                      <Link href={`/stocks/${t.symbol}`} className="font-mono font-semibold hover:text-primary">
                        {t.symbol}
                      </Link>
                    </span>
                    <span className="num shrink-0">{formatCents(t.priceCents)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span className="truncate">{t.league}</span>
                    <span className="shrink-0">{timeAgo(t.executedAt.getTime(), now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No trades yet.</Empty>
          )}
        </Section>
      </div>

      <Section
        title="Players"
        aside={
          stats.query
            ? `${number.format(stats.matchingPlayers)} matching “${stats.query}”`
            : `Newest first · ${number.format(totals.users)} in total`
        }
      >
        <form action="/admin" className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={stats.query}
            placeholder="Search by username or email"
            aria-label="Search players"
            autoComplete="off"
            className="h-11 rounded-xl pl-10"
          />
        </form>
        {stats.players.length ? (
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-normal">Player</th>
                  <th className="px-4 py-2.5 font-normal">Email</th>
                  <th className="px-4 py-2.5 font-normal">Joined</th>
                  <th className="px-4 py-2.5 font-normal">Last seen</th>
                  <th className="px-4 py-2.5 text-right font-normal">Trades</th>
                  <th className="px-2 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.players.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5">
                      <UserLink username={u.username} />
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {timeAgo(u.createdAt.getTime(), now)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {u.lastSeenAt ? timeAgo(u.lastSeenAt.getTime(), now) : "—"}
                    </td>
                    <td className="num px-4 py-2.5 text-right">{number.format(u.trades)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      {u.id === admin.id || u.isAdmin ? (
                        <span className="px-3 text-xs text-muted-foreground">
                          {u.id === admin.id ? "You" : "Admin"}
                        </span>
                      ) : (
                        <RemovePlayerButton userId={u.id} confirmation={u.username ?? u.email} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{stats.query ? "No players match that search." : "No players yet."}</Empty>
        )}
        {stats.matchingPlayers > stats.players.length && (
          <p className="text-xs text-muted-foreground">Showing the newest {LIST_LIMIT}. Search to find anyone else.</p>
        )}
      </Section>

      <Section title="Private leagues" aside={`Newest first · ${number.format(totals.privateLeagues)} in total`}>
        {stats.leagues.length ? (
          <ul className="surface divide-y">
            {stats.leagues.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-1.5 pr-2 pl-4 text-sm">
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{l.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {l.host ? `Host @${l.host}` : "No host"} · {number.format(l.players)}{" "}
                    {l.players === 1 ? "player" : "players"} · created {timeAgo(l.createdAt.getTime(), now)}
                  </span>
                </div>
                <DeleteLeagueButton leagueId={l.id} name={l.name} players={l.players} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No private leagues yet.</Empty>
        )}
      </Section>
    </div>
  );
}
