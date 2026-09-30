import { formatDuration } from "../leagues";
import { getMarketHours } from "./hours";

/** Every league trades the real US market, so its hours apply everywhere. */
export type MarketStatus = { state: "OPEN"; closesAt: Date } | { state: "CLOSED"; opensAt: Date };

export function marketStatus(now: Date): MarketStatus {
  const hours = getMarketHours(now);
  return hours.isOpen && hours.session
    ? { state: "OPEN", closesAt: hours.session.close }
    : { state: "CLOSED", opensAt: hours.nextOpen };
}

export function canTradeNow(status: MarketStatus): boolean {
  return status.state === "OPEN";
}

export function marketClosedMessage(status: MarketStatus, now: Date): string | null {
  if (status.state !== "CLOSED") return null;
  return `The US market is closed. It opens in ${formatDuration(status.opensAt.getTime() - now.getTime())}.`;
}
