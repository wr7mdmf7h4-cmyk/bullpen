"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useInstrumentSearch } from "@/hooks/use-instrument-search";
import { TickerBadge } from "@/components/market/ticker-badge";
import { cn } from "@/lib/utils";

/** ⌘K / Ctrl-K search across every US-listed stock and ETF. */
export function StockSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const { results, loading } = useInstrumentSearch(query, 8);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(symbol: string) {
    setOpen(false);
    setQuery("");
    router.push(`/stocks/${symbol}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Search stocks"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded border px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Search stocks</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="size-4 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter" && results[cursor]) {
                  go(results[cursor].symbol);
                }
              }}
              placeholder="Search any US stock or ETF…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded
              aria-controls="stock-search-results"
            />
          </div>
          <ul id="stock-search-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No matches</li>}
            {results.map((r, i) => (
              <li key={r.symbol} role="option" aria-selected={i === cursor}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(r.symbol)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left",
                    i === cursor && "bg-accent",
                  )}
                >
                  <TickerBadge symbol={r.symbol} className="size-8 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-semibold">{r.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.isEtf ? "ETF" : r.exchange}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
