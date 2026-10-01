"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends one anonymous page view per navigation to /api/track. No cookies;
 * skipped entirely when the browser asks not to be tracked (Global Privacy
 * Control or Do Not Track).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl || nav.doNotTrack === "1") return;
    // One view per page, even if the effect re-runs (e.g. React Strict Mode).
    if (lastSent.current === pathname) return;
    // Only the first page of a visit can come from another website.
    const referrer = lastSent.current === null ? document.referrer : "";
    lastSent.current = pathname;
    const body = JSON.stringify({ path: pathname, referrer });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" }))) {
      void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [pathname]);

  return null;
}
