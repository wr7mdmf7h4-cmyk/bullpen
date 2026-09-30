"use client";

import { ChartHero, type HistoryMeta } from "./chart-hero";
import { useLiveQuote } from "./live-quote-context";
import { MarketStatusPill, type MarketStatusDTO } from "./market-status-pill";
import type { PricePoint } from "@/domain/market/types";

export function StockChart({
  symbol,
  name,
  initialPoints,
  historyMeta,
  status,
}: {
  symbol: string;
  name: string;
  initialPoints: PricePoint[];
  historyMeta: HistoryMeta;
  status: MarketStatusDTO;
}) {
  const quote = useLiveQuote(symbol);
  return (
    <ChartHero
      chartSource={{ type: "stock", symbol }}
      eyebrow={<span className="sr-only">{name} price</span>}
      valueCents={quote.priceCents}
      baselineCents={quote.prevCloseCents}
      initialPoints={initialPoints}
      historyMeta={historyMeta}
      aside={<MarketStatusPill status={status} />}
    />
  );
}
