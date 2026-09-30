import { nextRank, rankTitle } from "@/domain/ranks";
import { formatBps } from "@/domain/money";
import { cn } from "@/lib/utils";

export function RankBadge({ returnBps, className }: { returnBps: number; className?: string }) {
  const rank = rankTitle(returnBps);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold",
        className,
      )}
    >
      <span aria-hidden>{rank.emoji}</span>
      {rank.title}
    </span>
  );
}

/** "Trader → Whale: +4.20% to go" with a progress bar. */
export function RankProgress({ returnBps }: { returnBps: number }) {
  const current = rankTitle(returnBps);
  const next = nextRank(returnBps);
  if (!next) {
    return <p className="text-xs text-muted-foreground">Top rank reached. Absolute unit. 🐋</p>;
  }
  const floor = current.minBps ?? returnBps - 500;
  const span = next.rank.minBps! - floor;
  const pct = Math.max(4, Math.min(100, Math.round(((returnBps - floor) / span) * 100)));
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          Next: {next.rank.emoji} {next.rank.title}
        </span>
        <span className="num">{formatBps(next.bpsToGo, { sign: true })} to go</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
