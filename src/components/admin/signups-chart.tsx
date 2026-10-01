"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function SignupsChart({ data }: { data: { day: string; count: number }[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="day"
            tickFormatter={dayLabel}
            interval="preserveStartEnd"
            minTickGap={24}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--foreground)", fillOpacity: 0.06 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as { day: string; count: number } | undefined;
              if (!active || !point) return null;
              return (
                <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                  <div className="text-muted-foreground">{dayLabel(point.day)}</div>
                  <div className="num font-semibold">
                    {point.count} sign-up{point.count === 1 ? "" : "s"}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
