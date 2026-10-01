"use client";

import { useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrafficBucket } from "@/domain/analytics";
import { cn } from "@/lib/utils";

type Range = "24h" | "30d";

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
// "2026-10-01 14" → "14:00"
const hourLabel = (bucket: string) => `${bucket.slice(11, 13)}:00`;

export function TrafficChart({ hourly, daily }: { hourly: TrafficBucket[]; daily: TrafficBucket[] }) {
  const [range, setRange] = useState<Range>("24h");
  const data = range === "24h" ? hourly : daily;
  const label = range === "24h" ? hourLabel : dayLabel;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/70" /> Page views
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-foreground" /> Visitors
          </span>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5 text-xs" role="tablist" aria-label="Time range">
          {(["24h", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "24h" ? "Last 24 hours" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <XAxis
              dataKey="bucket"
              tickFormatter={label}
              interval="preserveStartEnd"
              minTickGap={28}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.06 }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as TrafficBucket | undefined;
                if (!active || !point) return null;
                return (
                  <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                    <div className="text-muted-foreground">
                      {range === "24h"
                        ? `${dayLabel(point.bucket.slice(0, 10))}, ${hourLabel(point.bucket)}`
                        : dayLabel(point.bucket)}
                    </div>
                    <div className="num font-semibold">
                      {point.views} view{point.views === 1 ? "" : "s"} · {point.visitors} visitor
                      {point.visitors === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="views" fill="var(--primary)" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Line
              dataKey="visitors"
              type="monotone"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
