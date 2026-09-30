"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Clock, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLiveQuote } from "@/components/market/live-quote-context";
import { feeBreakdown, describeFees, type FeeSchedule } from "@/domain/fees";
import { formatBps, formatCents } from "@/domain/money";
import { maxAffordableShares, quoteOrder, validateOrder, type Side } from "@/domain/trading";
import { placeTradeAction } from "@/server/actions/trade";
import { announceAchievements, fireConfetti } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { HoldToConfirm } from "./hold-to-confirm";

export type Tradability = { ok: true } | { ok: false; reason: string };

export type TradeTicketProps = {
  leagueId: string;
  leagueName: string;
  symbol: string;
  fees: FeeSchedule;
  cashCents: number;
  heldQuantity: number;
  tradability: Tradability;
  initialSide?: Side;
  onDone?: () => void;
};

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-sm", muted && "text-muted-foreground")}>
      <span className={cn(!muted && "text-muted-foreground")}>{label}</span>
      <span className={cn("num", strong && "text-base font-semibold text-foreground")}>{value}</span>
    </div>
  );
}

export function TradeTicket({
  leagueId,
  leagueName,
  symbol,
  fees,
  cashCents,
  heldQuantity,
  tradability,
  initialSide = "BUY",
  onDone,
}: TradeTicketProps) {
  const router = useRouter();
  const quote = useLiveQuote(symbol);
  const [side, setSide] = useState<Side>(initialSide);
  const [qtyText, setQtyText] = useState("1");
  const [review, setReview] = useState<{ key: string; priceCents: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quantity = Number(qtyText);
  const priceCents = review?.priceCents ?? quote.priceCents;
  const validation = validateOrder({ side, quantity, priceCents, fees, cashCents, heldQuantity });
  const preview = Number.isInteger(quantity) && quantity > 0 ? quoteOrder(side, quantity, priceCents, fees) : null;
  const breakdown = preview ? feeBreakdown(preview.notionalCents, fees) : null;
  const max = side === "BUY" ? maxAffordableShares(cashCents, quote.priceCents, fees) : heldQuantity;
  const tone = side === "BUY" ? "buy" : "sell";

  function setQty(n: number) {
    setQtyText(String(Math.max(1, Math.min(n, 100_000))));
  }

  function openReview() {
    setNotice(null);
    // One idempotency key per review: retries of the same confirmation can
    // never place a second order.
    setReview({ key: crypto.randomUUID(), priceCents: quote.priceCents });
  }

  function confirm() {
    if (!review) return;
    startTransition(async () => {
      const res = await placeTradeAction({
        leagueId,
        symbol,
        side,
        quantity,
        expectedPriceCents: review.priceCents,
        idempotencyKey: review.key,
      });
      if (!res.ok) {
        if (res.code === "PRICE_MOVED" && res.priceCents) {
          setReview({ key: review.key, priceCents: res.priceCents });
          setNotice(`Price updated to ${formatCents(res.priceCents)}. Hold again to confirm at the new price.`);
          return;
        }
        setReview(null);
        toast.error(res.error);
        return;
      }
      const t = res.data;
      setReview(null);
      setQtyText("1");
      const verb = t.side === "BUY" ? "Bought" : "Sold";
      const pnl = t.realizedPnlCents;
      toast.success(`${verb} ${t.quantity} ${t.symbol} at ${formatCents(t.priceCents)}`, {
        description:
          pnl !== null
            ? `${pnl >= 0 ? "Profit" : "Loss"} of ${formatCents(Math.abs(pnl))} after fees`
            : `Fee ${formatCents(t.feeCents)} · cash left ${formatCents(t.cashCents)}`,
      });
      if (pnl !== null && pnl > 0) void fireConfetti();
      announceAchievements(t.achievements);
      onDone?.();
      router.refresh();
    });
  }

  if (!tradability.ok) {
    return (
      <div className="grid gap-3 text-center">
        <div className="mx-auto grid size-11 place-content-center rounded-full bg-muted">
          <Clock className="size-5 text-muted-foreground" />
        </div>
        <p className="font-medium">Trading paused</p>
        <p className="text-sm text-muted-foreground">{tradability.reason}</p>
        <p className="text-xs text-muted-foreground">
          Want to trade right now? Switch to <span className="text-foreground">24/7 Practice</span> in the league menu.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Order side" className="grid grid-cols-2 rounded-xl bg-muted p-1">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            onClick={() => setSide(s)}
            className={cn(
              "relative rounded-lg py-2 text-sm font-semibold text-muted-foreground transition-colors",
              side === s && (s === "BUY" ? "text-gain" : "text-loss"),
            )}
          >
            {side === s && (
              <motion.span
                layoutId={`side-pill-${symbol}`}
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{s === "BUY" ? "Buy" : "Sell"}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor={`qty-${symbol}`} className="text-sm text-muted-foreground">
            Shares
          </label>
          <button
            type="button"
            onClick={() => setQty(max)}
            disabled={max < 1}
            className="text-xs font-semibold text-primary disabled:text-muted-foreground"
          >
            Max {max.toLocaleString("en-US")}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="One fewer share"
            onClick={() => setQty(quantity - 1)}
          >
            <Minus />
          </Button>
          <input
            id={`qty-${symbol}`}
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            className="num h-9 min-w-0 flex-1 rounded-lg border bg-input/30 text-center text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="One more share"
            onClick={() => setQty(quantity + 1)}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Row label="Market price" value={formatCents(quote.priceCents)} />
        <Row
          label={side === "BUY" ? "Estimated cost" : "Estimated value"}
          value={preview ? formatCents(preview.notionalCents) : "—"}
        />
        <Row
          label={`Fee (${describeFees(fees).replace(" per trade", "")})`}
          value={preview ? formatCents(preview.feeCents) : "—"}
        />
        <div className="my-1 h-px bg-border" />
        <Row
          label={side === "BUY" ? "Total cost" : "You receive"}
          value={preview ? formatCents(preview.totalCents) : "—"}
          strong
        />
      </div>

      {!validation.ok && qtyText !== "" && (
        <p className="rounded-lg bg-loss/10 px-3 py-2 text-xs text-loss" role="status">
          {validation.message}
        </p>
      )}

      <Button
        size="lg"
        onClick={openReview}
        disabled={!validation.ok}
        className={cn(
          "h-12 rounded-xl text-base font-semibold",
          side === "SELL" && "bg-loss text-background hover:bg-loss/85",
        )}
      >
        Review {side === "BUY" ? "buy" : "sell"}
      </Button>

      <div className="grid gap-1 text-xs text-muted-foreground">
        <Row muted label="Buying power" value={formatCents(cashCents)} />
        <Row muted label={`${symbol} owned`} value={`${heldQuantity.toLocaleString("en-US")} shares`} />
      </div>

      <Dialog open={review !== null} onOpenChange={(o) => !o && !pending && setReview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {side === "BUY" ? "Buy" : "Sell"} {quantity} {symbol}
            </DialogTitle>
            <DialogDescription>Market order in {leagueName}. Fills immediately at the current price.</DialogDescription>
          </DialogHeader>
          {preview && breakdown && (
            <div className="grid gap-2 rounded-xl border bg-background/40 p-4">
              <Row label="Price per share" value={formatCents(preview.priceCents)} />
              <Row
                label={`${quantity} × ${formatCents(preview.priceCents)}`}
                value={formatCents(preview.notionalCents)}
              />
              <Row label="Flat fee" value={formatCents(breakdown.flatCents)} />
              <Row label={`Commission (${formatBps(fees.bps)})`} value={formatCents(breakdown.variableCents)} />
              <div className="my-1 h-px bg-border" />
              <Row
                label={side === "BUY" ? "Total cost" : "You receive"}
                value={formatCents(preview.totalCents)}
                strong
              />
              <Row muted label="Cash after" value={formatCents(cashCents + preview.netCashCents)} />
            </div>
          )}
          {notice && (
            <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold" role="status">
              {notice}
            </p>
          )}
          <HoldToConfirm
            tone={tone}
            label={`Hold to ${side === "BUY" ? "buy" : "sell"}`}
            onConfirm={confirm}
            pending={pending}
            disabled={!validation.ok}
          />
          <p className="text-center text-[11px] text-muted-foreground">
            Fake money, real maths. Fees are charged on every trade.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
