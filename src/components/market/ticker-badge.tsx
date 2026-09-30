import { hashString } from "@/domain/market/simulated";
import { cn } from "@/lib/utils";

/** Deterministic coloured monogram (no third-party logo API needed). */
export function TickerBadge({ symbol, className }: { symbol: string; className?: string }) {
  const hue = hashString(symbol) % 360;
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-content-center rounded-xl font-mono text-[11px] font-bold tracking-tight",
        className,
      )}
      style={{
        background: `oklch(0.3 0.06 ${hue})`,
        color: `oklch(0.9 0.1 ${hue})`,
        boxShadow: `inset 0 0 0 1px oklch(0.5 0.08 ${hue} / 0.35)`,
      }}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}
