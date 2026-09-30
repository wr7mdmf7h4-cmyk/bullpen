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

export type ChartSource = { type: "stock"; symbol: string } | { type: "portfolio"; portfolioId: string };

/** Where a chart's points came from (stocks only). */
export type HistoryMeta = { source: "candles" | "recorded" | "fake"; since: number | null };

function historyUrl(src: ChartSource, range: ChartRange) {
  return src.type === "stock"
    ? `/api/history?symbol=${encodeURIComponent(src.symbol)}&range=${range}`
    : `/api/portfolio-history?portfolioId=${src.portfolioId}&range=${range}`;
}

const sinceFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function describeHistory(meta: HistoryMeta | undefined): { footnote: string; empty: string } {
  if (!meta) {
    return {
      footnote: "Recorded portfolio values",
      empty: "Your portfolio's value is recorded as you trade and visit. The chart fills in over time.",
    };
  }
  if (meta.source === "fake") return { footnote: "Development build · fake prices", empty: "No data" };
  if (meta.source === "candles") return { footnote: "Real prices · Finnhub", empty: "No trades in this period." };
  const since = meta.since ? ` since ${sinceFmt.format(meta.since)}` : "";
  return {
    footnote: `Real prices${since}`,
    empty:
      "Collecting real price history. Bullpen records every real price it sees, so this chart fills in as the market trades.",
  };
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
  historyMeta,
  aside,
  height,
}: {
  chartSource: ChartSource;
  eyebrow?: React.ReactNode;
  valueCents: number;
  /** 1D baseline (previous close / start-of-day value) */
  baselineCents: number;
  initialPoints: PricePoint[];
  historyMeta?: HistoryMeta;
  aside?: React.ReactNode;
  height?: number;
}) {
  const [scrub, setScrub] = useState<ScrubPoint>(null);
  const [range, setRange] = useState<ChartRange>("1D");
  const [rangeStart, setRangeStart] = useState<number | undefined>(initialPoints[0]?.p);
  const [meta, setMeta] = useState<HistoryMeta | undefined>(historyMeta);

  const loadRange = useCallback(
    async (r: ChartRange) => {
      const res = await fetch(historyUrl(chartSource, r));
      if (!res.ok) throw new Error("history failed");
      const body = (await res.json()) as { points: PricePoint[] } & Partial<HistoryMeta>;
      if (body.source) setMeta({ source: body.source, since: body.since ?? null });
      return body.points;
    },
    [chartSource],
  );

  const shown = scrub ? scrub.point.p : valueCents;
  const base = range === "1D" ? baselineCents : (rangeStart ?? baselineCents);
  const change = shown - base;
  const changeBps = ratioBps(change, base);
  const label = scrub ? formatPointTime(scrub.point.t, scrub.range) : RANGE_LABEL[range];
  const { footnote, empty } = describeHistory(meta);

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
        emptyMessage={empty}
        height={height}
      />
    </section>
  );
}
