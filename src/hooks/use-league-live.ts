"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityItem, LeaderboardRow } from "@/server/leaderboard";

export type LeagueLiveData = { leaderboard: LeaderboardRow[]; activity: ActivityItem[] };
export type RealtimeMode = "ably" | "polling";

/**
 * Keeps a league's leaderboard and feed fresh.
 *
 * - "ably": subscribes to `league:<id>`; each message is an invalidation, so
 *   we refetch through the authorised endpoint. A slow 30s poll still runs to
 *   pick up price-driven leaderboard moves.
 * - "polling": refetches every 10s.
 * Both pause while the tab is hidden.
 */
export function useLeagueLive(leagueId: string, initial: LeagueLiveData, mode: RealtimeMode) {
  const [data, setData] = useState(initial);
  const [connected, setConnected] = useState(mode === "polling");
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    try {
      const res = await fetch(`/api/leagues/${leagueId}/live`, { signal: controller.signal });
      if (res.ok) setData((await res.json()) as LeagueLiveData);
    } catch {
      // keep the last good data
    }
  }, [leagueId]);

  useEffect(() => {
    const id = setInterval(refresh, mode === "ably" ? 30_000 : 10_000);
    const onVisible = () => !document.hidden && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      inflight.current?.abort();
    };
  }, [mode, refresh]);

  useEffect(() => {
    if (mode !== "ably") return;
    let closed = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const Ably = await import("ably");
      if (closed) return;
      const client = new Ably.Realtime({ authUrl: "/api/realtime/token" });
      const channel = client.channels.get(`league:${leagueId}`);
      client.connection.on((change) => setConnected(change.current === "connected"));
      await channel.subscribe(() => void refresh());
      cleanup = () => {
        channel.unsubscribe();
        client.close();
      };
      if (closed) cleanup();
    })();
    return () => {
      closed = true;
      cleanup?.();
    };
  }, [leagueId, mode, refresh]);

  return { data, connected, refresh };
}
