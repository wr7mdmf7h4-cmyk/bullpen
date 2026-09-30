import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { KeyStats } from "@/components/market/key-stats";
import { LiveQuotesProvider } from "@/components/market/live-quote-context";
import { StockChart } from "@/components/market/stock-chart";
import { TickerBadge } from "@/components/market/ticker-badge";
import { getInstrument } from "@/domain/market/universe";
import { marketStatus } from "@/domain/market/status";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";
import { getActivePortfolio } from "@/server/leagues/active";
import { getHistory, getKeyStats, getQuote, usesRealQuotes } from "@/server/market";
import { requireUser } from "@/server/users";
import { db } from "@/server/db";
import { getTradability } from "@/server/leagues/tradability";
import { PositionCard } from "@/components/trade/position-card";
import { TradeHistory } from "@/components/trade/trade-history";
import { TradePanel } from "@/components/trade/trade-panel";

export async function generateMetadata({ params }: PageProps<"/stocks/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  const def = getInstrument(symbol);
  return { title: def ? `${def.symbol} · ${def.name}` : "Stock not found" };
}

export default async function StockPage({ params }: PageProps<"/stocks/[symbol]">) {
  const user = await requireUser();
  const def = getInstrument((await params).symbol);
  if (!def) notFound();

  const portfolio = await getActivePortfolio(user.id);
  const source = portfolio.league.marketSource;
  const now = new Date();
  const [quote, history, stats, holding, trades] = await Promise.all([
    getQuote(def.symbol, source, now),
    getHistory(def.symbol, source, "1D", now),
    getKeyStats(def.symbol, source, now),
    db.holding.findUnique({ where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: def.symbol } } }),
    db.trade.findMany({
      where: { portfolioId: portfolio.id, symbol: def.symbol },
      orderBy: { executedAt: "desc" },
      take: 10,
    }),
  ]);
  const { league } = portfolio;

  return (
    <LiveQuotesProvider initial={[serializeQuote(quote)]} source={source}>
      <div className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
        <div className="grid min-w-0 content-start gap-8">
          <header className="flex items-center gap-3">
            <TickerBadge symbol={def.symbol} className="size-12 text-xs" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">{def.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono font-medium text-foreground">{def.symbol}</span>
                <Badge variant="secondary" className="font-normal">
                  {def.sector}
                </Badge>
              </div>
            </div>
          </header>
          <StockChart
            key={`${def.symbol}-${source}`}
            symbol={def.symbol}
            name={def.name}
            source={source}
            initialPoints={history.points}
            illustrative={history.illustrative}
            status={serializeStatus(marketStatus(source, now))}
            realQuotes={usesRealQuotes(source)}
          />
          {holding && (
            <PositionCard
              symbol={def.symbol}
              quantity={holding.quantity}
              costBasisCents={holding.costBasisCents}
              heldDays={Math.floor((now.getTime() - holding.openedAt.getTime()) / 86_400_000)}
            />
          )}
          <KeyStats stats={stats} sector={def.sector} exchange={def.exchange} />
          <section className="grid gap-3" aria-labelledby="your-trades">
            <h2 id="your-trades" className="text-lg font-semibold">
              Your {def.symbol} trades
            </h2>
            <TradeHistory
              trades={trades}
              showSymbol={false}
              emptyText={`You haven't traded ${def.symbol} in ${league.name} yet.`}
            />
          </section>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <TradePanel
            leagueId={league.id}
            leagueName={league.name}
            symbol={def.symbol}
            fees={{ flatCents: league.feeFlatCents, bps: league.feeBps }}
            cashCents={portfolio.cashCents}
            heldQuantity={holding?.quantity ?? 0}
            tradability={getTradability(league, now)}
          />
        </aside>
      </div>
    </LiveQuotesProvider>
  );
}
