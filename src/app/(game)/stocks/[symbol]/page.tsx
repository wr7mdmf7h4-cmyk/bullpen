import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { KeyStats } from "@/components/market/key-stats";
import { LiveQuotesProvider } from "@/components/market/live-quote-context";
import { StockChart } from "@/components/market/stock-chart";
import { TickerBadge } from "@/components/market/ticker-badge";
import { enrichSector, findInstrument } from "@/server/instruments";
import { UNKNOWN_SECTOR } from "@/domain/market/universe";
import { marketStatus } from "@/domain/market/status";
import { serializeQuote } from "@/lib/serialize";
import { serializeStatus } from "@/lib/market-status";
import { getActivePortfolio } from "@/server/leagues/active";
import type { Quote } from "@/domain/market/types";
import { getHistory, getKeyStats, getQuote, PriceUnavailableError } from "@/server/market";
import { requireUser } from "@/server/users";
import { db } from "@/server/db";
import { getTradability } from "@/server/leagues/tradability";
import { PositionCard } from "@/components/trade/position-card";
import { TradeHistory } from "@/components/trade/trade-history";
import { TradePanel } from "@/components/trade/trade-panel";

export async function generateMetadata({ params }: PageProps<"/stocks/[symbol]">): Promise<Metadata> {
  const { symbol } = await params;
  const def = await findInstrument(decodeURIComponent(symbol));
  return { title: def ? `${def.symbol} · ${def.name}` : "Stock not found" };
}

export default async function StockPage({ params }: PageProps<"/stocks/[symbol]">) {
  const user = await requireUser();
  const found = await findInstrument(decodeURIComponent((await params).symbol));
  if (!found) notFound();
  const def = await enrichSector(found);

  const portfolio = await getActivePortfolio(user.id);
  const { league } = portfolio;
  const now = new Date();
  let quote: Quote | null = null;
  try {
    quote = await getQuote(def.symbol, now);
  } catch (err) {
    if (!(err instanceof PriceUnavailableError)) throw err;
  }

  const [history, stats, holding, trades] = await Promise.all([
    getHistory(def.symbol, "1D", now, quote ?? undefined),
    quote ? getKeyStats(quote, now) : null,
    db.holding.findUnique({ where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: def.symbol } } }),
    db.trade.findMany({
      where: { portfolioId: portfolio.id, symbol: def.symbol },
      orderBy: { executedAt: "desc" },
      take: 10,
    }),
  ]);

  const header = (
    <header className="flex items-center gap-3">
      <TickerBadge symbol={def.symbol} className="size-12 text-xs" />
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{def.name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{def.symbol}</span>
          <span className="text-xs">{def.exchange}</span>
          {def.sector !== UNKNOWN_SECTOR && (
            <Badge variant="secondary" className="font-normal">
              {def.sector}
            </Badge>
          )}
          {!def.isActive && (
            <Badge variant="destructive" className="font-normal">
              Delisted
            </Badge>
          )}
        </div>
      </div>
    </header>
  );

  if (!quote) {
    return (
      <div className="grid gap-8">
        {header}
        <div className="surface grid justify-items-center gap-2 p-10 text-center">
          <p className="text-3xl">⏳</p>
          <p className="font-medium">Live price unavailable right now</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Bullpen only shows real prices, and the data provider didn&apos;t return one for {def.symbol} just now
            (usually a short rate limit). Refresh in a minute.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveQuotesProvider initial={[serializeQuote(quote)]}>
      <div className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-0">
        <div className="grid min-w-0 content-start gap-8">
          {header}
          <StockChart
            key={def.symbol}
            symbol={def.symbol}
            name={def.name}
            initialPoints={history.points}
            historyMeta={{ source: history.source, since: history.since }}
            status={serializeStatus(marketStatus(now))}
          />
          {holding && (
            <PositionCard
              symbol={def.symbol}
              quantity={holding.quantity}
              costBasisCents={holding.costBasisCents}
              heldDays={Math.floor((now.getTime() - holding.openedAt.getTime()) / 86_400_000)}
            />
          )}
          {stats && <KeyStats stats={stats} sector={def.sector} exchange={def.exchange} />}
          <section className="grid gap-3" aria-labelledby="your-trades">
            <h2 id="your-trades" className="text-lg font-semibold">
              Your {def.symbol} trades
            </h2>
            <TradeHistory
              trades={trades}
              showSymbol={false}
              emptyText={`You haven't traded ${def.symbol} in ${portfolio.linked ? "your main portfolio" : league.name} yet.`}
            />
          </section>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <TradePanel
            leagueId={league.id}
            leagueName={portfolio.linked ? `your main portfolio (counts in ${portfolio.viewLeague.name})` : league.name}
            symbol={def.symbol}
            fees={{ flatCents: league.feeFlatCents, bps: league.feeBps }}
            cashCents={portfolio.cashCents}
            heldQuantity={holding?.quantity ?? 0}
            tradability={
              def.isActive
                ? getTradability(league, now)
                : {
                    ok: false,
                    reason: `${def.symbol} is no longer listed, so it can't be traded. You can still hold it.`,
                  }
            }
          />
        </aside>
      </div>
    </LiveQuotesProvider>
  );
}
