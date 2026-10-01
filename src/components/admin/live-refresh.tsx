"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Re-fetches the (server-rendered) admin page every few seconds while the tab
 * is visible, and immediately when you come back to it.
 */
export function LiveRefresh({ updatedAt, intervalMs = 10_000 }: { updatedAt: string; intervalMs?: number }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
      <span className={cn("size-1.5 rounded-full bg-primary", refreshing ? "opacity-40" : "animate-pulse-dot")} />
      Live · updated <span className="num text-foreground">{updatedAt}</span>
    </span>
  );
}
