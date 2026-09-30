import type { MarketSourceKind } from "../leagues";
import { formatDuration } from "../leagues";
import { getMarketHours } from "./hours";
import type { MarketCalendar } from "./simulated";

export function calendarFor(source: MarketSourceKind): MarketCalendar {
  return source === "LIVE" ? "NYSE" : "ALWAYS";
}

export type MarketStatus =
  | { state: "ALWAYS_OPEN" }
  | { state: "OPEN"; closesAt: Date }
  | { state: "CLOSED"; opensAt: Date };

export function marketStatus(source: MarketSourceKind, now: Date): MarketStatus {
  if (source === "SIMULATED") return { state: "ALWAYS_OPEN" };
  const hours = getMarketHours(now);
  return hours.isOpen && hours.session
    ? { state: "OPEN", closesAt: hours.session.close }
    : { state: "CLOSED", opensAt: hours.nextOpen };
}

export function canTradeNow(status: MarketStatus): boolean {
  return status.state !== "CLOSED";
}

export function marketClosedMessage(status: MarketStatus, now: Date): string | null {
  if (status.state !== "CLOSED") return null;
  return `The US market is closed. It opens in ${formatDuration(status.opensAt.getTime() - now.getTime())}.`;
}
