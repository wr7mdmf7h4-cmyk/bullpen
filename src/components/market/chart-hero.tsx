"use client";

import { useCallback, useState } from "react";
import { formatCents, ratioBps } from "@/domain/money";
import type { ChartRange, PricePoint } from "@/domain/market/types";
import { Delta } from "./delta";
import { FlashNumber } from "./flash-number";
import { PriceChart, formatPointTime, type ScrubPoint } from "./price-chart";

const RANGE_LABEL: Record<ChartRange, string> = {
  "1D": "Today",
  "1W": "Past week",
  "1M": "Past month",
  "3M": "Past 3 months",
  "6M": "Past 6 months",
  YTD: "Year to date",
  "1Y": "Past year",
  "5Y": "Past 5 years",
};

export type ChartSource =
  { type: "stock"; symbol: string; source: "LIVE" | "SIMULATED" } | { type: "portfolio"; portfolioId: string };

function historyUrl(src: ChartSource, range: ChartRange) {
  return src.type === "stock"
    ? `/api/history?symbol=${src.symbol}&source=${src.source}&range=${range}`
    : `/api/portfolio-history?portfolioId=${src.portfolioId}&range=${range}`;
}

/**
 * Big headline number + chart. Hovering/dragging the chart scrubs the headline
 * to the value at that moment, with the change measured from the start of the
 * range (or from the previous close for 1D).
 */
export function ChartHero({
  chartSource,
  eyebrow,
  valueCents,
  baselineCents,
  initialPoints,
  footnote,
  aside,
  height,
}: {
  chartSource: ChartSource;
  eyebrow?: React.ReactNode;
  valueCents: number;
  /** 1D baseline (previous close / start-of-day value) */
  baselineCents: number;
  initialPoints: PricePoint[];
  footnote?: React.ReactNode;
  aside?: React.ReactNode;
  height?: number;
}) {
  const [scrub, setScrub] = useState<ScrubPoint>(null);
  const [range, setRange] = useState<ChartRange>("1D");
  const [rangeStart, setRangeStart] = useState<number | undefined>(initialPoints[0]?.p);

  const loadRange = useCallback(
    async (r: ChartRange) => {
      const res = await fetch(historyUrl(chartSource, r));
      if (!res.ok) throw new Error("history failed");
      const body = (await res.json()) as { points: PricePoint[] };
      return body.points;
    },
    [chartSource],
  );

  const shown = scrub ? scrub.point.p : valueCents;
  const base = range === "1D" ? baselineCents : (rangeStart ?? baselineCents);
  const change = shown - base;
  const changeBps = ratioBps(change, base);
  const label = scrub ? formatPointTime(scrub.point.t, scrub.range) : RANGE_LABEL[range];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          {eyebrow}
          <div className="num text-4xl font-semibold tracking-tight sm:text-5xl">
            {scrub ? formatCents(shown) : <FlashNumber value={shown}>{formatCents(shown)}</FlashNumber>}
          </div>
          <div className="flex items-center gap-2">
            <Delta cents={change} bps={changeBps} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        </div>
        {aside}
      </div>
      <PriceChart
        loadRange={loadRange}
        initialPoints={initialPoints}
        baselineCents={baselineCents}
        liveValue={valueCents}
        onScrub={setScrub}
        onRangeChange={(r, first) => {
          setRange(r);
          setRangeStart(first?.p);
        }}
        footnote={footnote}
        height={height}
      />
    </section>
  );
}
