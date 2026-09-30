"use client";

import { useLiveQuote } from "@/components/market/live-quote-context";
import { Delta } from "@/components/market/delta";
import { formatCents, ratioBps } from "@/domain/money";
import { averageCostCents } from "@/domain/trading";
import { changeCents } from "@/domain/market/types";

export function PositionCard({
  symbol,
  quantity,
  costBasisCents,
  heldDays,
}: {
  symbol: string;
  quantity: number;
  costBasisCents: number;
  heldDays: number;
}) {
  const quote = useLiveQuote(symbol);
  const value = quantity * quote.priceCents;
  const pnl = value - costBasisCents;
  const today = quantity * changeCents(quote);
  return (
    <section className="grid gap-4" aria-labelledby="position">
      <h2 id="position" className="text-lg font-semibold">
        Your position
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Shares" value={quantity.toLocaleString("en-US")} />
        <Tile label="Market value" value={formatCents(value)} />
        <Tile label="Average cost" value={formatCents(averageCostCents({ quantity, costBasisCents }))} />
        <Tile label="Held for" value={heldDays === 0 ? "Today" : `${heldDays} day${heldDays === 1 ? "" : "s"}`} />
        <Tile label="Total return" value={<Delta cents={pnl} bps={ratioBps(pnl, costBasisCents)} />} wide />
        <Tile label="Today's return" value={<Delta cents={today} bps={ratioBps(today, value - today)} />} wide />
      </div>
    </section>
  );
}

function Tile({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`surface grid gap-1 p-3.5 ${wide ? "col-span-1 sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num text-base font-semibold">{value}</span>
    </div>
  );
}
