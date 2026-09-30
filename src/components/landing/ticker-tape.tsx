import { formatBps, formatCents } from "@/domain/money";
import { changeBps } from "@/domain/market/types";
import type { Quote } from "@/domain/market/types";

/** Infinite CSS marquee of prices (content duplicated so the loop is seamless). */
export function TickerTape({ quotes }: { quotes: Quote[] }) {
  const items = quotes.map((q) => {
    const bps = changeBps(q);
    return (
      <span key={q.symbol} className="flex items-center gap-2 px-5 text-sm whitespace-nowrap">
        <span className="font-mono font-semibold">{q.symbol}</span>
        <span className="num text-muted-foreground">{formatCents(q.priceCents)}</span>
        <span className={`num ${bps >= 0 ? "text-gain" : "text-loss"}`}>
          {bps >= 0 ? "▲" : "▼"} {formatBps(Math.abs(bps))}
        </span>
      </span>
    );
  });
  return (
    <div
      className="relative overflow-hidden border-y bg-card/40 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] py-3"
      aria-label="Market ticker"
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        <div className="flex">{items}</div>
        <div className="flex" aria-hidden>
          {items}
        </div>
      </div>
    </div>
  );
}
