"use client";

import { useEffect, useRef } from "react";
import { announceAchievements } from "@/lib/celebrate";
import type { UnlockedAchievement } from "@/server/achievements";

/** Pops toasts for achievements unlocked by time passing (e.g. Diamond Hands). */
export function AchievementAnnouncer({ unlocked }: { unlocked: UnlockedAchievement[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !unlocked.length) return;
    done.current = true;
    announceAchievements(unlocked);
  }, [unlocked]);
  return null;
}
