import { cn } from "@/lib/utils";

/** Tiny dependency-free SVG sparkline (dozens render on the markets page). */
export function Sparkline({
  points,
  className,
  positive,
}: {
  points: number[];
  className?: string;
  positive?: boolean;
}) {
  if (points.length < 2) return <div className={cn("h-8 w-24", className)} />;
  const w = 96;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 2 - ((p - min) / span) * (h - 4)).toFixed(1)}`)
    .join("");
  const up = positive ?? points[points.length - 1]! >= points[0]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-24", className)} aria-hidden>
      <path d={d} fill="none" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" className={up ? "stroke-gain" : "stroke-loss"} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
