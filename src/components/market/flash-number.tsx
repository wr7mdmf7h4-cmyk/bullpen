"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a value and briefly flashes green/red when it changes. Uses the
 * "adjust state while rendering" pattern (no effect needed to detect changes).
 */
export function FlashNumber({
  value,
  children,
  className,
}: {
  value: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState<{ dir: "up" | "down"; id: number } | null>(null);

  if (value !== prev) {
    setPrev(value);
    setFlash({ dir: value > prev ? "up" : "down", id: (flash?.id ?? 0) + 1 });
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 900);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <span
      key={flash?.id}
      className={cn(
        "-mx-1 rounded-md px-1 transition-colors",
        flash?.dir === "up" && "animate-flash-gain",
        flash?.dir === "down" && "animate-flash-loss",
        className,
      )}
    >
      {children}
    </span>
  );
}
