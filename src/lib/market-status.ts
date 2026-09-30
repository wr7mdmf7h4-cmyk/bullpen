import type { MarketStatus } from "@/domain/market/status";
import type { MarketStatusDTO } from "@/components/market/market-status-pill";

export function serializeStatus(s: MarketStatus): MarketStatusDTO {
  if (s.state === "OPEN") return { state: "OPEN", closesAt: s.closesAt.getTime() };
  if (s.state === "CLOSED") return { state: "CLOSED", opensAt: s.opensAt.getTime() };
  return { state: "ALWAYS_OPEN" };
}
