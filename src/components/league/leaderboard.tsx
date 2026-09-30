"use client";

import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { UserAvatar } from "@/components/user-avatar";
import { formatBps, formatCents } from "@/domain/money";
import type { LeaderboardRow } from "@/server/leaderboard";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

function returnClass(bps: number) {
  return bps > 0 ? "text-gain" : bps < 0 ? "text-loss" : "text-muted-foreground";
}

export function Podium({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  const top = rows.slice(0, 3);
  if (top.length < 3) return null;
  // Visual order: 2nd, 1st, 3rd
  const order = [top[1]!, top[0]!, top[2]!];
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
      {order.map((r, i) => {
        const first = i === 1;
        return (
          <motion.div
            layout
            key={r.userId}
            className={cn(
              "surface relative grid justify-items-center gap-1.5 px-2 pt-5 pb-4 text-center",
              first && "border-gold/40 bg-gradient-to-b from-gold/10 to-card pt-7 pb-6",
              r.userId === meId && "ring-1 ring-primary/50",
            )}
          >
            <span className="absolute -top-3 text-2xl" aria-label={`Rank ${r.rank}`}>
              {MEDALS[r.rank - 1] ?? `#${r.rank}`}
            </span>
            <UserAvatar seed={r.avatarSeed} name={r.username} className={first ? "size-14" : "size-11"} />
            <Link href={`/u/${r.username}`} className="max-w-full truncate text-sm font-semibold hover:underline">
              {r.username}
            </Link>
            <span className={cn("num text-lg font-bold sm:text-xl", returnClass(r.returnBps), first && "glow-gain")}>
              {formatBps(r.returnBps, { sign: true })}
            </span>
            <span className="num text-xs text-muted-foreground">{formatCents(r.totalValueCents)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function LeaderboardList({ rows, meId, limit = 50 }: { rows: LeaderboardRow[]; meId: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  const me = rows.find((r) => r.userId === meId);
  const meHidden = me && !shown.includes(me);

  if (!rows.length) {
    return (
      <p className="surface p-8 text-center text-sm text-muted-foreground">No players yet. Share the invite link!</p>
    );
  }

  return (
    <LayoutGroup>
      <ol className="surface divide-y overflow-hidden">
        {shown.map((r) => (
          <Row key={r.userId} row={r} me={r.userId === meId} />
        ))}
        {meHidden && (
          <>
            <li className="py-1 text-center text-xs text-muted-foreground">⋯</li>
            <Row row={me} me />
          </>
        )}
      </ol>
    </LayoutGroup>
  );
}

function Row({ row: r, me }: { row: LeaderboardRow; me: boolean }) {
  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className={cn("flex items-center gap-3 px-4 py-3", me && "bg-primary/[0.06]")}
    >
      <span className="num w-7 text-center text-sm font-semibold text-muted-foreground">
        {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
      </span>
      <UserAvatar seed={r.avatarSeed} name={r.username} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/u/${r.username}`} className="truncate text-sm font-medium hover:underline">
            {r.username}
          </Link>
          {me && <span className="rounded bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">YOU</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {r.titleEmoji} {r.title} · {r.tradeCount} trades
        </div>
      </div>
      <div className="grid justify-items-end">
        <span className={cn("num text-sm font-semibold", returnClass(r.returnBps))}>
          {r.returnBps > 0 ? "▲ " : r.returnBps < 0 ? "▼ " : ""}
          {formatBps(Math.abs(r.returnBps))}
        </span>
        <span className="num text-xs text-muted-foreground">{formatCents(r.totalValueCents)}</span>
      </div>
    </motion.li>
  );
}
