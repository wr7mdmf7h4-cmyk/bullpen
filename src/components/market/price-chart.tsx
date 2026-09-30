"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { CHART_RANGES, type ChartRange, type PricePoint } from "@/domain/market/types";
import { formatCents } from "@/domain/money";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatPointTime(t: number, range: ChartRange) {
  if (range === "1D") return timeFmt.format(t);
  if (range === "1Y") return dateFmt.format(t);
  return dayFmt.format(t);
}

export type ScrubPoint = { point: PricePoint; range: ChartRange; first: PricePoint; baseline: number } | null;

type Props = {
  /** fetches history for a range; lets the same chart serve stocks and portfolios */
  loadRange: (range: ChartRange) => Promise<PricePoint[]>;
  initialRange?: ChartRange;
  initialPoints: PricePoint[];
  /** dashed reference line for 1D (previous close) */
  baselineCents?: number;
  /** keeps the last point in sync with a live price */
  liveValue?: number;
  onScrub?: (scrub: ScrubPoint) => void;
  onRangeChange?: (range: ChartRange, first: PricePoint | undefined) => void;
  footnote?: React.ReactNode;
  height?: number;
  ranges?: readonly ChartRange[];
};

/**
 * Robinhood-style price chart: one line, no axes, colour set by direction
 * over the range, a dashed previous-close baseline, and a crosshair that
 * "scrubs" the headline number as you drag across it.
 */
export function PriceChart({
  loadRange,
  initialRange = "1D",
  initialPoints,
  baselineCents,
  liveValue,
  onScrub,
  onRangeChange,
  footnote,
  height = 260,
  ranges = CHART_RANGES,
}: Props) {
  const gradientId = useId();
  const [range, setRange] = useState<ChartRange>(initialRange);
  const [points, setPoints] = useState<PricePoint[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  async function selectRange(next: ChartRange) {
    if (next === range) return;
    setRange(next);
    setLoading(true);
    setError(false);
    const id = ++requestId.current;
    try {
      const pts = await loadRange(next);
      if (id !== requestId.current) return;
      setPoints(pts);
      onRangeChange?.(next, pts[0]);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  // Keep the right edge in step with the live price.
  const data = useMemo(() => {
    if (liveValue === undefined || !points.length) return points;
    const last = points[points.length - 1]!;
    if (last.p === liveValue) return points;
    return [...points.slice(0, -1), { ...last, p: liveValue }];
  }, [points, liveValue]);

  const first = data[0];
  const last = data[data.length - 1];
  const baseline = range === "1D" && baselineCents ? baselineCents : (first?.p ?? 0);
  const up = (last?.p ?? 0) >= baseline;
  const color = up ? "var(--gain)" : "var(--loss)";

  useEffect(() => {
    onRangeChange?.(range, data[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report the initial range once
  }, []);

  const domain = useMemo(() => {
    if (!data.length) return [0, 1];
    let min = Math.min(...data.map((d) => d.p));
    let max = Math.max(...data.map((d) => d.p));
    if (range === "1D" && baselineCents) {
      min = Math.min(min, baselineCents);
      max = Math.max(max, baselineCents);
    }
    const pad = Math.max(1, (max - min) * 0.08);
    return [min - pad, max + pad];
  }, [data, range, baselineCents]);

  return (
    <div className="grid gap-3">
      <div className="relative" style={{ height }}>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 0, bottom: 8, left: 0 }}
              onMouseMove={(state) => {
                const idx = Number(state?.activeTooltipIndex);
                const pt = Number.isInteger(idx) ? data[idx] : undefined;
                if (pt && first) onScrub?.({ point: pt, range, first, baseline });
              }}
              onMouseLeave={() => onScrub?.(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={domain} />
              <ReferenceLine y={baseline} stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeDasharray="2 4" />
              <Tooltip
                cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.35, strokeWidth: 1 }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const pt = payload?.[0]?.payload as PricePoint | undefined;
                  if (!active || !pt) return null;
                  return (
                    <div className="num rounded-lg border bg-popover/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur">
                      <div className="font-semibold text-foreground">{formatCents(pt.p)}</div>
                      <div className="text-muted-foreground">{formatPointTime(pt.t, range)}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="p"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)", fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-content-center text-sm text-muted-foreground">Not enough data yet.</div>
        )}
        {loading && <div className="absolute inset-0 animate-pulse rounded-xl bg-background/40" aria-label="Loading chart" />}
        {error && (
          <div className="absolute inset-0 grid place-content-center text-sm text-loss">Couldn&apos;t load this range.</div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div role="tablist" aria-label="Chart range" className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              onClick={() => void selectRange(r)}
              className={cn(
                "relative rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground",
                r === range && (up ? "text-gain" : "text-loss"),
              )}
            >
              {r === range && (
                <motion.span
                  layoutId={`range-pill-${gradientId}`}
                  className={cn("absolute inset-0 -z-10 rounded-full", up ? "bg-gain/12" : "bg-loss/12")}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              {r}
            </button>
          ))}
        </div>
        {footnote && <div className="text-right text-[11px] text-muted-foreground">{footnote}</div>}
      </div>
    </div>
  );
}
