import type { Metadata } from "next";
import { MarketsTable, type MarketRow } from "@/components/market/markets-table";
import { MarketStatusPill } from "@/components/market/market-status-pill";
import { countInstruments, popularInstruments } from "@/server/instruments";
import { marketStatus } from "@/domain/market/status";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";
import { getActivePortfolio } from "@/server/leagues/active";
import { getHistory, getPopularQuotes, usesRealQuotes } from "@/server/market";
import { requireUser } from "@/server/users";

export const metadata: Metadata = { title: "Markets" };

function downsample<T>(items: T[], target: number): T[] {
  if (items.length <= target) return items;
  const step = (items.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => items[Math.round(i * step)]!);
}

export default async function MarketsPage() {
  const user = await requireUser();
  const portfolio = await getActivePortfolio(user.id);
  const source = portfolio.league.marketSource;
  const now = new Date();

  const [quotes, popular, universeCount] = await Promise.all([
    getPopularQuotes(source, now),
    popularInstruments(),
    countInstruments(),
  ]);
  const rows: MarketRow[] = await Promise.all(
    popular.map(async (def) => {
      const history = await getHistory(def.symbol, source, "1D", now, quotes.get(def.symbol));
      return {
        symbol: def.symbol,
        name: def.name,
        sector: def.sector,
        spark: downsample(history.points, 40).map((p) => p.p),
      };
    }),
  );

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">
            Prices for <span className="text-foreground">{portfolio.league.name}</span>
          </p>
        </div>
        <MarketStatusPill status={serializeStatus(marketStatus(source, now))} realQuotes={usesRealQuotes(source)} />
      </header>
      <MarketsTable
        rows={rows}
        initialQuotes={[...quotes.values()].map(serializeQuote)}
        source={source}
        universeCount={universeCount}
      />
    </div>
  );
}
