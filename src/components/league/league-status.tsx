import { formatDuration, leagueStatus } from "@/domain/leagues";
import { cn } from "@/lib/utils";

export function LeagueStatusBadge({
  league,
  now,
  className,
}: {
  league: { startsAt: Date; endsAt: Date | null };
  now: Date;
  className?: string;
}) {
  const status = leagueStatus(league, now);
  const text =
    status === "UPCOMING"
      ? `Starts in ${formatDuration(league.startsAt.getTime() - now.getTime())}`
      : status === "ENDED"
        ? "Ended"
        : league.endsAt
          ? `${formatDuration(league.endsAt.getTime() - now.getTime())} left`
          : "Ongoing";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "ACTIVE" && "border-primary/30 text-primary",
        status === "UPCOMING" && "border-gold/30 text-gold",
        status === "ENDED" && "text-muted-foreground",
        className,
      )}
    >
      {status === "ACTIVE" && <span className="size-1.5 animate-pulse-dot rounded-full bg-primary" />}
      {text}
    </span>
  );
}

export function MarketSourceBadge({ source }: { source: "LIVE" | "SIMULATED" }) {
  return (
    <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {source === "LIVE" ? "Live US market" : "Simulated · 24/7"}
    </span>
  );
}
