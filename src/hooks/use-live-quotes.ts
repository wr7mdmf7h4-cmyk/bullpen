"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuoteDTO } from "@/lib/serialize";

/**
 * Keeps a set of quotes fresh by polling /api/quotes. Pauses while the tab is
 * hidden. Simulated prices tick every 5s; live quotes are cached ~15s upstream.
 */
export function useLiveQuotes(initial: QuoteDTO[], source: "LIVE" | "SIMULATED", enabled = true) {
  const [quotes, setQuotes] = useState<Record<string, QuoteDTO>>(() =>
    Object.fromEntries(initial.map((q) => [q.symbol, q])),
  );
  const symbols = useMemo(() => initial.map((q) => q.symbol).sort().join(","), [initial]);
  const intervalMs = source === "SIMULATED" ? 5_000 : 15_000;

  useEffect(() => {
    if (!enabled || !symbols) return;
    let cancelled = false;
    let controller: AbortController | undefined;

    async function tick() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(`/api/quotes?source=${source}&symbols=${symbols}`, { signal: controller.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { quotes: QuoteDTO[] };
        if (!cancelled) {
          setQuotes((prev) => {
            const next = { ...prev };
            for (const q of body.quotes) next[q.symbol] = q;
            return next;
          });
        }
      } catch {
        // network blip or abort: keep showing the last known prices
      }
    }

    const id = setInterval(tick, intervalMs);
    const onVisible = () => !document.hidden && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [symbols, source, intervalMs, enabled]);

  return quotes;
}
