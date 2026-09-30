import { formatBps, formatCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export function toneClass(value: number) {
  return value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-muted-foreground";
}

/** ▲ +$1.23 (+0.54%) — colour is never the only signal, the arrow carries direction too. */
export function Delta({
  cents,
  bps,
  className,
  showCents = true,
  size = "sm",
}: {
  cents?: number;
  bps: number;
  className?: string;
  showCents?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const direction = cents ?? bps;
  const arrow = direction > 0 ? "▲" : direction < 0 ? "▼" : "•";
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 font-medium whitespace-nowrap",
        size === "xs" && "text-xs",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        toneClass(direction),
        className,
      )}
    >
      <span aria-hidden className="text-[0.7em]">
        {arrow}
      </span>
      {showCents && cents !== undefined && <span>{formatCents(Math.abs(cents))}</span>}
      <span>{showCents && cents !== undefined ? `(${formatBps(Math.abs(bps))})` : formatBps(bps, { sign: true })}</span>
      <span className="sr-only">{direction > 0 ? "up" : direction < 0 ? "down" : "unchanged"}</span>
    </span>
  );
}
