import type { Metadata } from "next";
import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import { TradeHistory } from "@/components/trade/trade-history";
import { describeFees } from "@/domain/fees";
import { formatBps } from "@/domain/money";
import { getActivePortfolio } from "@/server/leagues/active";
import { requireUser } from "@/server/users";
import { loadPortfolioOverview, recentTrades } from "@/server/views";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await requireUser();
  const active = await getActivePortfolio(user.id);
  const [{ props, allocation, detail }, trades] = await Promise.all([
    loadPortfolioOverview(active.id),
    recentTrades(active.id, 30),
  ]);

  return (
    <div className="grid gap-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          {active.linked
            ? `Main portfolio · counts in ${active.viewLeague.name} and every other linked league`
            : detail.league.name}{" "}
          · fees {describeFees({ flatCents: detail.league.feeFlatCents, bps: detail.league.feeBps })}
        </p>
      </header>

      <PortfolioOverview key={props.portfolioId} {...props} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid content-start gap-3" aria-labelledby="history">
          <h2 id="history" className="text-lg font-semibold">
            Trade history
          </h2>
          <TradeHistory trades={trades} emptyText="Your trades will show up here." />
        </section>

        <section className="grid content-start gap-3" aria-labelledby="allocation">
          <h2 id="allocation" className="text-lg font-semibold">
            Allocation by sector
          </h2>
          {allocation.length === 0 ? (
            <p className="surface p-6 text-center text-sm text-muted-foreground">100% cash. Very zen.</p>
          ) : (
            <ul className="surface grid gap-3 p-4">
              {allocation.map((a) => (
                <li key={a.sector} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{a.sector}</span>
                    <span className="num text-muted-foreground">{formatBps(a.bps, { decimals: 1 })}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-2" style={{ width: `${a.bps / 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
