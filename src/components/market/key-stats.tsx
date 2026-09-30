import { formatCents } from "@/domain/money";
import type { KeyStats as KeyStatsData } from "@/server/market";

const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="num text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

const cents = (v: number | null) => (v === null ? "—" : formatCents(v));

export function KeyStats({ stats, sector, exchange }: { stats: KeyStatsData; sector: string; exchange: string }) {
  return (
    <section className="grid gap-2" aria-labelledby="key-stats">
      <h2 id="key-stats" className="text-lg font-semibold">
        Key stats
      </h2>
      <dl className="grid gap-x-10 sm:grid-cols-2">
        <Stat label="Open" value={cents(stats.openCents)} />
        <Stat label="Previous close" value={cents(stats.prevCloseCents)} />
        <Stat label="Day high" value={cents(stats.highCents)} />
        <Stat label="Day low" value={cents(stats.lowCents)} />
        <Stat label="52-week high" value={cents(stats.yearHighCents)} />
        <Stat label="52-week low" value={cents(stats.yearLowCents)} />
        {stats.marketCapDollars !== null && <Stat label="Market cap" value={compactUsd.format(stats.marketCapDollars)} />}
        {stats.peRatio !== null && <Stat label="P/E ratio" value={stats.peRatio.toFixed(2)} />}
        <Stat label="Sector" value={sector} />
        <Stat label="Exchange" value={exchange} />
      </dl>
    </section>
  );
}
