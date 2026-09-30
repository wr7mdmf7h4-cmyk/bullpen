"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GameError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="surface mx-auto grid max-w-md justify-items-center gap-3 p-10 text-center">
      <p className="text-4xl">📉</p>
      <h1 className="text-xl font-semibold">Something crashed (not the market, us)</h1>
      <p className="text-sm text-muted-foreground">
        Your balances are safe: every trade is all-or-nothing. Try again in a moment.
      </p>
      <Button onClick={reset} className="rounded-xl">
        Try again
      </Button>
    </div>
  );
}
