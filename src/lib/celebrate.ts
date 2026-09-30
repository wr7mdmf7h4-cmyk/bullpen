"use client";

import { createElement } from "react";
import { toast } from "sonner";
import type { UnlockedAchievement } from "@/server/achievements";

const NEON = ["#4bf58c", "#b5ff5e", "#5ee6ff", "#ffe066", "#ffffff"];

/** Confetti burst for a profitable sell. Lazy-loaded so it costs nothing until used. */
export async function fireConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const base = { spread: 70, ticks: 220, gravity: 1.1, colors: NEON, disableForReducedMotion: true };
  void confetti({ ...base, particleCount: 90, origin: { x: 0.5, y: 0.65 } });
  setTimeout(() => {
    void confetti({ ...base, particleCount: 45, angle: 60, origin: { x: 0, y: 0.8 } });
    void confetti({ ...base, particleCount: 45, angle: 120, origin: { x: 1, y: 0.8 } });
  }, 180);
}

export function announceAchievements(list: UnlockedAchievement[]) {
  list.forEach((a, i) => {
    setTimeout(
      () => {
        toast(a.name, {
          description: a.description,
          icon: createElement("span", { className: "text-xl leading-none" }, a.emoji),
          duration: 6000,
          className: "border-gold/40!",
        });
      },
      600 + i * 900,
    );
  });
}
