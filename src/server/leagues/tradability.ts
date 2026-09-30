import "server-only";
import { formatDuration, leagueStatus } from "@/domain/leagues";
import { marketClosedMessage, marketStatus } from "@/domain/market/status";
import type { Tradability } from "@/components/trade/trade-ticket";

/** Whether a league's members can trade right now, with a human reason if not. */
export function getTradability(
  league: { startsAt: Date; endsAt: Date | null; marketSource: "LIVE" | "SIMULATED" },
  now = new Date(),
): Tradability {
  const status = leagueStatus(league, now);
  if (status === "UPCOMING") {
    return { ok: false, reason: `This league starts in ${formatDuration(league.startsAt.getTime() - now.getTime())}.` };
  }
  if (status === "ENDED") return { ok: false, reason: "This league has ended. Final standings are locked in." };
  const closed = marketClosedMessage(marketStatus(league.marketSource, now), now);
  return closed ? { ok: false, reason: closed } : { ok: true };
}
