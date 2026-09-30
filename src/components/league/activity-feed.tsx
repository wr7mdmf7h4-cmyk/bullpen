"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { UserAvatar } from "@/components/user-avatar";
import type { ActivityItem } from "@/server/leaderboard";
import { cn } from "@/lib/utils";

function relative(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!items.length) {
    return (
      <p className={cn("surface p-8 text-center text-sm text-muted-foreground", className)}>
        Quiet on the trading floor… for now.
      </p>
    );
  }

  return (
    <ul className={cn("surface divide-y overflow-hidden", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: -12, backgroundColor: "oklch(0.87 0.2 152 / 0.12)" }}
            animate={{ opacity: 1, y: 0, backgroundColor: "oklch(0.87 0.2 152 / 0)" }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 px-4 py-3"
          >
            <UserAvatar seed={item.avatarSeed} name={item.username} className="size-8" />
            <p className="min-w-0 flex-1 text-sm">
              <span
                className={cn(
                  item.tone === "gain" && "text-gain",
                  item.tone === "loss" && "text-loss",
                  item.tone === "celebrate" && "text-gold",
                )}
              >
                {item.symbol ? <LinkedText text={item.text} symbol={item.symbol} /> : item.text}
              </span>{" "}
              <span aria-hidden>{item.emoji}</span>
            </p>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={new Date(item.createdAt).toISOString()}>
              {relative(item.createdAt, now)}
            </time>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Turns the ticker inside "sam sold 5 TSLA for a profit" into a link. */
function LinkedText({ text, symbol }: { text: string; symbol: string }) {
  const at = text.indexOf(` ${symbol}`);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at + 1)}
      <Link href={`/stocks/${symbol}`} className="font-mono font-semibold hover:underline">
        {symbol}
      </Link>
      {text.slice(at + 1 + symbol.length)}
    </>
  );
}
