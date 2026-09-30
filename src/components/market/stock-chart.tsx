"use client";

import { ChartHero } from "./chart-hero";
import { useLiveQuote } from "./live-quote-context";
import { MarketStatusPill, type MarketStatusDTO } from "./market-status-pill";
import type { PricePoint } from "@/domain/market/types";

export function StockChart({
  symbol,
  name,
  source,
  initialPoints,
  illustrative,
  status,
  realQuotes,
}: {
  symbol: string;
  name: string;
  source: "LIVE" | "SIMULATED";
  initialPoints: PricePoint[];
  illustrative: boolean;
  status: MarketStatusDTO;
  realQuotes: boolean;
}) {
  const quote = useLiveQuote(symbol);
  return (
    <ChartHero
      chartSource={{ type: "stock", symbol, source }}
      eyebrow={<span className="sr-only">{name} price</span>}
      valueCents={quote.priceCents}
      baselineCents={quote.prevCloseCents}
      initialPoints={initialPoints}
      aside={<MarketStatusPill status={status} realQuotes={realQuotes} />}
      footnote={
        illustrative
          ? "Live price · chart shape is illustrative"
          : source === "SIMULATED" || !realQuotes
            ? "Simulated market data"
            : undefined
      }
    />
  );
}
