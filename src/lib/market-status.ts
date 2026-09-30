import type { MarketStatus } from "@/domain/market/status";
import type { MarketStatusDTO } from "@/components/market/market-status-pill";

export function serializeStatus(s: MarketStatus): MarketStatusDTO {
  return s.state === "OPEN"
    ? { state: "OPEN", closesAt: s.closesAt.getTime() }
    : { state: "CLOSED", opensAt: s.opensAt.getTime() };
}
