import Link from "next/link";
import { formatCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export type TradeRow = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  priceCents: number;
  feeCents: number;
  netCashCents: number;
  realizedPnlCents: number | null;
  executedAt: Date;
  leagueName?: string;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

export function TradeHistory({
  trades,
  showSymbol = true,
  emptyText = "No trades yet.",
}: {
  trades: TradeRow[];
  showSymbol?: boolean;
  emptyText?: React.ReactNode;
}) {
  if (!trades.length) {
    return <div className="surface p-6 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <ul className="surface divide-y overflow-hidden">
      {trades.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-content-center rounded-full text-[10px] font-bold",
              t.side === "BUY" ? "bg-gain/12 text-gain" : "bg-loss/12 text-loss",
            )}
            aria-hidden
          >
            {t.side === "BUY" ? "B" : "S"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {t.side === "BUY" ? "Bought" : "Sold"} {t.quantity.toLocaleString("en-US")}{" "}
              {showSymbol ? (
                <Link href={`/stocks/${t.symbol}`} className="font-mono hover:underline">
                  {t.symbol}
                </Link>
              ) : (
                "shares"
              )}{" "}
              <span className="text-muted-foreground">@ {formatCents(t.priceCents)}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {dateFmt.format(t.executedAt)} ET · fee {formatCents(t.feeCents)}
              {t.leagueName && ` · ${t.leagueName}`}
            </div>
          </div>
          <div className="grid justify-items-end text-sm">
            <span className="num font-medium">{formatCents(t.netCashCents, { sign: true })}</span>
            {t.realizedPnlCents !== null && (
              <span className={cn("num text-xs", t.realizedPnlCents >= 0 ? "text-gain" : "text-loss")}>
                {t.realizedPnlCents >= 0 ? "▲" : "▼"} {formatCents(Math.abs(t.realizedPnlCents))} P&amp;L
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
