"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const HOLD_MS = 900;

/**
 * Press-and-hold confirmation: the deliberate friction real brokers use before
 * an irreversible order. Works with mouse, touch and keyboard (hold Space/Enter).
 */
export function HoldToConfirm({
  onConfirm,
  label,
  tone,
  pending,
  disabled,
}: {
  onConfirm: () => void;
  label: string;
  tone: "buy" | "sell";
  pending?: boolean;
  disabled?: boolean;
}) {
  const controls = useAnimationControls();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  function start() {
    if (disabled || pending || timer.current) return;
    setHolding(true);
    void controls.start({ scaleX: 1, transition: { duration: HOLD_MS / 1000, ease: "linear" } });
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      if (navigator.vibrate) navigator.vibrate(20);
      onConfirm();
    }, HOLD_MS);
  }

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
    void controls.start({ scaleX: 0, transition: { duration: 0.2 } });
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (!pending) void controls.start({ scaleX: 0, transition: { duration: 0.2 } });
  }, [pending, controls]);

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // synthetic events (tests, assistive tech) may not have a capturable pointer
        }
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label}. Press and hold to confirm.`}
      className={cn(
        "relative h-13 w-full touch-none overflow-hidden rounded-xl text-base font-semibold select-none disabled:opacity-60",
        tone === "buy" ? "bg-gain/15 text-gain ring-1 ring-gain/40" : "bg-loss/15 text-loss ring-1 ring-loss/40",
      )}
    >
      <motion.span
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={controls}
        style={{ originX: 0 }}
        className={cn("absolute inset-0", tone === "buy" ? "bg-gain" : "bg-loss")}
      />
      <span
        className={cn(
          "relative flex items-center justify-center gap-2 transition-colors",
          (holding || pending) && "text-background",
        )}
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : holding ? "Keep holding…" : label}
      </span>
    </button>
  );
}
