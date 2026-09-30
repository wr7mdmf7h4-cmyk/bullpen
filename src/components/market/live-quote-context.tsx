"use client";

import { createContext, useContext } from "react";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import type { QuoteDTO } from "@/lib/serialize";

const LiveQuotesContext = createContext<Record<string, QuoteDTO> | null>(null);

/** Shares one polling loop between everything on a page that shows a price. */
export function LiveQuotesProvider({
  initial,
  source,
  children,
}: {
  initial: QuoteDTO[];
  source: "LIVE" | "SIMULATED";
  children: React.ReactNode;
}) {
  const quotes = useLiveQuotes(initial, source);
  return <LiveQuotesContext.Provider value={quotes}>{children}</LiveQuotesContext.Provider>;
}

export function useLiveQuote(symbol: string): QuoteDTO {
  const quotes = useContext(LiveQuotesContext);
  const q = quotes?.[symbol];
  if (!q) throw new Error(`No live quote for ${symbol}; wrap in <LiveQuotesProvider>`);
  return q;
}
