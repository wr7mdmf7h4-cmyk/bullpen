"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/domain/leagues";
import { cn } from "@/lib/utils";

export type MarketStatusDTO = { state: "OPEN"; closesAt: number } | { state: "CLOSED"; opensAt: number };

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** US market status with a live countdown; refreshes the page at the open/close. */
export function MarketStatusPill({ status, className }: { status: MarketStatusDTO; className?: string }) {
  const now = useNow(15_000);
  const router = useRouter();
  const boundary = status.state === "OPEN" ? status.closesAt : status.opensAt;

  useEffect(() => {
    if (now >= boundary) router.refresh();
  }, [boundary, now, router]);

  const base = "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";
  if (status.state === "CLOSED") {
    return (
      <span className={cn(base, "text-muted-foreground", className)}>
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Market closed · opens in {formatDuration(status.opensAt - now)}
      </span>
    );
  }
  return (
    <span className={cn(base, "border-primary/25 bg-primary/5 text-foreground", className)}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
      </span>
      Market open · live
    </span>
  );
}
