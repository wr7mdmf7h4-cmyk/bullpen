"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChartHero } from "@/components/market/chart-hero";
import { Delta, toneClass } from "@/components/market/delta";
import { FlashNumber } from "@/components/market/flash-number";
import { MarketStatusPill, type MarketStatusDTO } from "@/components/market/market-status-pill";
import { TickerBadge } from "@/components/market/ticker-badge";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { valuePortfolio, type HoldingInput } from "@/domain/portfolio";
import { formatCents } from "@/domain/money";
import type { PricePoint } from "@/domain/market/types";
import type { QuoteDTO } from "@/lib/serialize";
import { RankBadge, RankProgress } from "./rank-badge";

type Props = {
  portfolioId: string;
  leagueName: string;
  source: "LIVE" | "SIMULATED";
  startingCashCents: number;
  cashCents: number;
  realizedPnlCents: number;
  feesPaidCents: number;
  holdings: (HoldingInput & { name: string })[];
  initialQuotes: QuoteDTO[];
  startOfDayCents: number;
  initialPoints: PricePoint[];
  status: MarketStatusDTO;
  realQuotes: boolean;
  compact?: boolean;
};

/**
 * Live portfolio: the same pure `valuePortfolio` used on the server runs here
 * against polled quotes, so values tick without a round trip per render.
 */
export function PortfolioOverview(props: Props) {
  const quotes = useLiveQuotes(props.initialQuotes, props.source);
  const prices = Object.fromEntries(Object.values(quotes).map((q) => [q.symbol, q.priceCents]));
  const v = valuePortfolio(props.cashCents, props.holdings, prices, props.startingCashCents);
  const names = Object.fromEntries(props.holdings.map((h) => [h.symbol, h.name]));

  return (
    <div className="grid gap-8">
      <ChartHero
        chartSource={{ type: "portfolio", portfolioId: props.portfolioId }}
        eyebrow={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Portfolio value</span>
            <RankBadge returnBps={v.totalReturnBps} />
          </div>
        }
        valueCents={v.totalValueCents}
        baselineCents={props.startOfDayCents}
        initialPoints={props.initialPoints}
        aside={<MarketStatusPill status={props.status} realQuotes={props.realQuotes} />}
        height={props.compact ? 200 : 260}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash" value={formatCents(v.cashCents)} />
        <Stat label="Invested" value={formatCents(v.holdingsValueCents)} />
        <Stat label="Total return" value={<Delta cents={v.totalReturnCents} bps={v.totalReturnBps} />} />
        <Stat
          label="Unrealised P&L"
          value={
            <span className={toneClass(v.unrealizedPnlCents)}>{formatCents(v.unrealizedPnlCents, { sign: true })}</span>
          }
        />
        {!props.compact && (
          <>
            <Stat
              label="Realised P&L"
              value={
                <span className={toneClass(props.realizedPnlCents)}>
                  {formatCents(props.realizedPnlCents, { sign: true })}
                </span>
              }
            />
            <Stat label="Fees paid" value={formatCents(props.feesPaidCents)} />
            <Stat label="Starting cash" value={formatCents(props.startingCashCents)} />
            <div className="surface grid content-center gap-1 p-4">
              <RankProgress returnBps={v.totalReturnBps} />
            </div>
          </>
        )}
      </div>

      <section className="grid gap-3" aria-labelledby="holdings">
        <div className="flex items-center justify-between">
          <h2 id="holdings" className="text-lg font-semibold">
            Holdings
          </h2>
          <span className="text-sm text-muted-foreground">{v.positions.length} positions</span>
        </div>
        {v.positions.length === 0 ? (
          <div className="surface grid justify-items-center gap-3 p-10 text-center">
            <p className="text-3xl">🌱</p>
            <p className="font-medium">No positions yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              You have {formatCents(v.cashCents)} burning a hole in your pocket in {props.leagueName}.
            </p>
            <Link
              href="/markets"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Browse markets <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead className="hidden border-b text-xs text-muted-foreground sm:table-header-group">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Return</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {v.positions.map((p) => (
                  <tr key={p.symbol} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <Link href={`/stocks/${p.symbol}`} className="flex items-center gap-3">
                        <TickerBadge symbol={p.symbol} className="size-9" />
                        <span className="min-w-0">
                          <span className="block font-mono font-semibold">{p.symbol}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            <span className="sm:hidden">{p.quantity} shares · </span>
                            {names[p.symbol]}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="num hidden px-4 py-3 text-right sm:table-cell">
                      {p.quantity.toLocaleString("en-US")}
                    </td>
                    <td className="num hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                      {formatCents(p.averageCostCents)}
                    </td>
                    <td className="num hidden px-4 py-3 text-right sm:table-cell">
                      <FlashNumber value={p.priceCents}>{formatCents(p.priceCents)}</FlashNumber>
                    </td>
                    <td className="num px-4 py-3 text-right font-medium">
                      {formatCents(p.marketValueCents)}
                      <div className="h-1 overflow-hidden rounded-full bg-muted sm:hidden">
                        <div className="h-full bg-chart-2" style={{ width: `${p.weightBps / 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Delta cents={p.unrealizedPnlCents} bps={p.unrealizedPnlBps} showCents={false} size="xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface grid gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num text-lg font-semibold">{value}</span>
    </div>
  );
}
