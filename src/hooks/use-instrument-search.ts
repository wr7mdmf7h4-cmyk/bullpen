"use client";

import { useEffect, useMemo, useState } from "react";
import { searchPopular } from "@/domain/market/universe";
import type { SearchResult } from "@/app/api/search/route";

const popularAsResults = (q: string, limit: number): SearchResult[] =>
  searchPopular(q, limit).map((i) => ({
    symbol: i.symbol,
    name: i.name,
    exchange: i.exchange,
    sector: i.sector,
    isEtf: i.sector === "ETF",
  }));

/**
 * Debounced search across the full universe. Popular matches are derived
 * instantly from the bundled list while the server search is in flight.
 */
export function useInstrumentSearch(query: string, limit = 8) {
  const q = query.trim();
  const [server, setServer] = useState<{ q: string; results: SearchResult[] } | null>(null);
  const instant = useMemo(() => popularAsResults(q, limit), [q, limit]);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal: controller.signal });
        if (res.ok) setServer({ q, results: ((await res.json()) as { results: SearchResult[] }).results });
      } catch {
        // aborted or offline: keep showing the instant popular matches
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, limit]);

  const fresh = server !== null && server.q === q;
  return { results: q && fresh ? server.results : instant, loading: Boolean(q) && !fresh };
}
