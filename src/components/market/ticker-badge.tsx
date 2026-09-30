import { cn } from "@/lib/utils";

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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
      {symbol.replace(".", "").slice(0, 4)}
    </span>
  );
}
