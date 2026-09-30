"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Side } from "@/domain/trading";
import { TradeTicket, type TradeTicketProps } from "./trade-ticket";

/**
 * Desktop: the ticket sits in a sticky side column.
 * Mobile: a sticky Buy/Sell bar above the tab bar opens the ticket in a sheet.
 */
export function TradePanel(props: Omit<TradeTicketProps, "initialSide" | "onDone">) {
  const [mobileSide, setMobileSide] = useState<Side | null>(null);

  return (
    <>
      <div className="surface hidden p-5 lg:block">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Trade {props.symbol}</h2>
        <TradeTicket {...props} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.1rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/90 px-4 py-3 backdrop-blur-xl md:bottom-0 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-11 rounded-xl font-semibold"
            onClick={() => setMobileSide("BUY")}
            disabled={!props.tradability.ok}
          >
            Buy
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-xl font-semibold text-loss"
            onClick={() => setMobileSide("SELL")}
            disabled={!props.tradability.ok || props.heldQuantity === 0}
          >
            Sell
          </Button>
        </div>
      </div>

      <Sheet open={mobileSide !== null} onOpenChange={(o) => !o && setMobileSide(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle>Trade {props.symbol}</SheetTitle>
          </SheetHeader>
          {mobileSide && <TradeTicket {...props} initialSide={mobileSide} onDone={() => setMobileSide(null)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
