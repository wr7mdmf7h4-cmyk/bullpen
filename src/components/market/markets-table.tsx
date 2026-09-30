"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/domain/money";
import { changeBps, changeCents } from "@/domain/market/types";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useInstrumentSearch } from "@/hooks/use-instrument-search";
import type { QuoteDTO } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { Delta } from "./delta";
import { FlashNumber } from "./flash-number";
import { Sparkline } from "./sparkline";
import { TickerBadge } from "./ticker-badge";

export type MarketRow = { symbol: string; name: string; sector: string; spark: number[] };

export function MarketsTable({
  rows,
  initialQuotes,
  source,
  universeCount,
}: {
  rows: MarketRow[];
  initialQuotes: QuoteDTO[];
  source: "LIVE" | "SIMULATED";
  universeCount: number;
}) {
  const quotes = useLiveQuotes(initialQuotes, source);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string | null>(null);

  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector))].sort(), [rows]);
  const searching = query.trim().length > 0;
  const search = useInstrumentSearch(query, 25);
  const visible = rows.filter((r) => !sector || r.sector === sector);

  const movers = useMemo(() => {
    const withChange = rows
      .map((r) => ({ row: r, q: quotes[r.symbol]! }))
      .filter((x) => x.q)
      .map((x) => ({ ...x, bps: changeBps(x.q) }));
    const sorted = [...withChange].sort((a, b) => b.bps - a.bps);
    return { gainers: sorted.slice(0, 4), losers: sorted.slice(-4).reverse() };
  }, [rows, quotes]);

  const searchBox = (
    <div className="relative">
      {search.loading ? (
        <Loader2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${universeCount.toLocaleString("en-US")} US stocks & ETFs by ticker or name`}
        aria-label="Search stocks"
        className="h-12 rounded-xl pl-10 text-base"
      />
    </div>
  );

  if (searching) {
    return (
      <div className="grid gap-4">
        {searchBox}
        {search.results.length === 0 && !search.loading ? (
          <div className="surface grid place-content-center gap-1 p-10 text-center">
            <p className="font-medium">No US-listed stock or ETF matches “{query}”</p>
            <p className="text-sm text-muted-foreground">Try the ticker symbol, e.g. BRK.B or TSM.</p>
          </div>
        ) : (
          <ul className="surface divide-y overflow-hidden">
            {search.results.map((r) => {
              const q = quotes[r.symbol];
              return (
                <li key={r.symbol}>
                  <Link
                    href={`/stocks/${r.symbol}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <TickerBadge symbol={r.symbol} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{r.symbol}</span>
                        {r.isEtf && (
                          <span className="rounded bg-chart-2/15 px-1.5 text-[10px] font-semibold text-chart-2">
                            ETF
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.name} · {r.exchange}
                      </div>
                    </div>
                    {q ? (
                      <div className="grid justify-items-end gap-0.5">
                        <span className="num text-sm font-semibold">{formatCents(q.priceCents)}</span>
                        <Delta bps={changeBps(q)} cents={changeCents(q)} showCents={false} size="xs" />
                      </div>
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {searchBox}
      <section className="grid gap-4 sm:grid-cols-2">
        {(["gainers", "losers"] as const).map((kind) => (
          <div key={kind} className="surface p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {kind === "gainers" ? "Top gainers today" : "Top losers today"}
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {movers[kind].map(({ row, q, bps }) => (
                <li key={row.symbol}>
                  <Link
                    href={`/stocks/${row.symbol}`}
                    className="flex items-center justify-between rounded-xl bg-accent/50 px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <span className="font-mono text-sm font-semibold">{row.symbol}</span>
                    <Delta bps={bps} cents={changeCents(q)} showCents={false} size="xs" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold">Popular</h2>
          <div className="-mx-4 flex scrollbar-none gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {[null, ...sectors].map((s) => (
              <button
                key={s ?? "all"}
                onClick={() => setSector(s)}
                aria-pressed={sector === s}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  sector === s && "border-primary/40 bg-primary/10 text-foreground",
                )}
              >
                {s ?? "All"}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="surface p-10 text-center text-sm text-muted-foreground">Nothing popular in this sector.</div>
        ) : (
          <ul className="surface divide-y overflow-hidden">
            {visible.map((row) => {
              const q = quotes[row.symbol];
              if (!q) return null;
              const bps = changeBps(q);
              return (
                <li key={row.symbol}>
                  <Link
                    href={`/stocks/${row.symbol}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <TickerBadge symbol={row.symbol} />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-semibold">{row.symbol}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.name}</div>
                    </div>
                    <Sparkline points={row.spark} positive={bps >= 0} className="hidden sm:block" />
                    <div className="grid justify-items-end gap-0.5">
                      <FlashNumber value={q.priceCents} className="num text-sm font-semibold">
                        {formatCents(q.priceCents)}
                      </FlashNumber>
                      <Delta bps={bps} cents={changeCents(q)} showCents={false} size="xs" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
