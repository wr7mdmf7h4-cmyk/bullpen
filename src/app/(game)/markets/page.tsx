import type { Metadata } from "next";
import { MarketsTable, type MarketRow } from "@/components/market/markets-table";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { marketStatus } from "@/domain/market/status";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";
import { countInstruments, popularInstruments } from "@/server/instruments";
import { getPopularQuotes, getSparklines } from "@/server/market";
import { requireUser } from "@/server/users";

export const metadata: Metadata = { title: "Markets" };

export default async function MarketsPage() {
  await requireUser();
  const now = new Date();
  const [quotes, popular, universeCount] = await Promise.all([
    getPopularQuotes(now),
    popularInstruments(),
    countInstruments(),
  ]);
  const sparks = await getSparklines(
    popular.map((p) => p.symbol),
    now,
  );
  const rows: MarketRow[] = popular.map((def) => ({
    symbol: def.symbol,
    name: def.name,
    sector: def.sector,
    spark: sparks.get(def.symbol) ?? [],
  }));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">Real US stock prices</p>
        </div>
        <MarketStatusPill status={serializeStatus(marketStatus(now))} />
      </header>
      <MarketsTable
        rows={rows}
        initialQuotes={[...quotes.values()].map(serializeQuote)}
        universeCount={universeCount}
      />
    </div>
  );
}
