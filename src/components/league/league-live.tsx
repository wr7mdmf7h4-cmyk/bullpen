"use client";

import { useState } from "react";
import { useLeagueLive, type LeagueLiveData, type RealtimeMode } from "@/hooks/use-league-live";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { LeaderboardList, Podium } from "./leaderboard";

export function LeagueLive({
  leagueId,
  meId,
  initial,
  mode,
}: {
  leagueId: string;
  meId: string;
  initial: LeagueLiveData;
  mode: RealtimeMode;
}) {
  const { data, connected } = useLeagueLive(leagueId, initial, mode);
  const [tab, setTab] = useState<"board" | "feed">("board");

  const indicator = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("size-1.5 rounded-full", connected ? "animate-pulse-dot bg-primary" : "bg-muted-foreground")}
      />
      {mode === "ably" ? (connected ? "Live" : "Connecting…") : "Auto-refreshing"}
    </span>
  );

  return (
    <div className="grid gap-6">
      {/* mobile tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-muted p-1 lg:hidden" role="tablist">
        {(["board", "feed"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold text-muted-foreground",
              tab === t && "bg-card text-foreground shadow-sm ring-1 ring-border",
            )}
          >
            {t === "board" ? "Leaderboard" : "Activity"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section
          className={cn("grid content-start gap-4", tab !== "board" && "hidden lg:grid")}
          aria-labelledby="board"
        >
          <div className="flex items-center justify-between">
            <h2 id="board" className="text-lg font-semibold">
              Leaderboard
            </h2>
            {indicator}
          </div>
          <Podium rows={data.leaderboard} meId={meId} />
          <LeaderboardList rows={data.leaderboard} meId={meId} />
        </section>
        <section className={cn("grid content-start gap-4", tab !== "feed" && "hidden lg:grid")} aria-labelledby="feed">
          <div className="flex items-center justify-between">
            <h2 id="feed" className="text-lg font-semibold">
              Activity
            </h2>
            <span className="lg:hidden">{indicator}</span>
          </div>
          <ActivityFeed items={data.activity} />
        </section>
      </div>
    </div>
  );
}
