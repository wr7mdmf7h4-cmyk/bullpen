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
  const [quote, history, stats] = await Promise.all([
    getQuote(def.symbol, source, now),
    getHistory(def.symbol, source, "1D", now),
    getKeyStats(def.symbol, source, now),
  ]);

  return (
    <LiveQuotesProvider initial={[serializeQuote(quote)]} source={source}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
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
            symbol={def.symbol}
            name={def.name}
            source={source}
            initialPoints={history.points}
            illustrative={history.illustrative}
            status={serializeStatus(marketStatus(source, now))}
            realQuotes={usesRealQuotes(source)}
          />
          <KeyStats stats={stats} sector={def.sector} exchange={def.exchange} />
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">{/* trade panel lands in phase 3 */}</aside>
      </div>
    </LiveQuotesProvider>
  );
}
