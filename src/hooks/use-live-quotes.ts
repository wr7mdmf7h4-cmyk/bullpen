"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuoteDTO } from "@/lib/serialize";

/**
 * Keeps a set of quotes fresh by polling /api/quotes. Pauses while the tab is
 * hidden. Quotes are cached ~60s upstream, so polling every 30s is plenty.
 */
function toRecord(list: QuoteDTO[]) {
  return Object.fromEntries(list.map((q) => [q.symbol, q]));
}

export function useLiveQuotes(initial: QuoteDTO[], enabled = true) {
  const [quotes, setQuotes] = useState<Record<string, QuoteDTO>>(() => toRecord(initial));
  // Fresh server data (router.refresh after a trade or a league switch)
  // replaces whatever we were holding. Done during render so there is never a
  // frame of stale prices.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setQuotes(toRecord(initial));
  }
  const symbols = useMemo(
    () =>
      initial
        .map((q) => q.symbol)
        .sort()
        .join(","),
    [initial],
  );
  const intervalMs = 30_000; // real quotes are cached ~60s upstream

  useEffect(() => {
    if (!enabled || !symbols) return;
    let cancelled = false;
    let controller: AbortController | undefined;

    async function tick() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(`/api/quotes?symbols=${symbols}`, { signal: controller.signal });
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
  }, [symbols, intervalMs, enabled]);

  return quotes;
}
