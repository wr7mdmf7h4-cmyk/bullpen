import "server-only";
import Ably from "ably";
import { env } from "./env";

/**
 * Realtime behind one interface.
 *
 * Events are *invalidations*, not data: "league X changed, refetch". Clients
 * then load the leaderboard/feed through the normal authorised endpoint, so the
 * realtime channel never carries anything private and both transports
 * (Ably push, or 10s polling) share one code path.
 */

export type LeagueEvent = "activity" | "leaderboard";

export interface RealtimePublisher {
  readonly mode: "ably" | "polling";
  publish(channel: string, event: string, data: unknown): Promise<void>;
}

class AblyPublisher implements RealtimePublisher {
  readonly mode = "ably" as const;
  constructor(private readonly rest: Ably.Rest) {}
  async publish(channel: string, event: string, data: unknown) {
    await this.rest.channels.get(channel).publish(event, data);
  }
}

/** No push transport configured: clients poll instead, so publishing is a no-op. */
class PollingPublisher implements RealtimePublisher {
  readonly mode = "polling" as const;
  async publish() {}
}

let publisher: RealtimePublisher | undefined;
let ablyRest: Ably.Rest | undefined;

function getAblyRest(): Ably.Rest | undefined {
  const key = env().ABLY_API_KEY;
  if (!key) return undefined;
  ablyRest ??= new Ably.Rest({ key });
  return ablyRest;
}

export function getPublisher(): RealtimePublisher {
  if (!publisher) {
    const rest = getAblyRest();
    publisher = rest ? new AblyPublisher(rest) : new PollingPublisher();
  }
  return publisher;
}

export function leagueChannel(leagueId: string) {
  return `league:${leagueId}`;
}

/** Fire-and-forget: a realtime hiccup must never fail a trade. */
export async function notifyLeague(leagueId: string, event: LeagueEvent) {
  try {
    await getPublisher().publish(leagueChannel(leagueId), event, { at: Date.now() });
  } catch (err) {
    console.error("[realtime] publish failed", err);
  }
}

/** Short-lived, subscribe-only Ably token for the browser. */
export async function createClientTokenRequest(userId: string) {
  const rest = getAblyRest();
  if (!rest) return null;
  return rest.auth.createTokenRequest({
    clientId: userId,
    capability: { "league:*": ["subscribe"] },
    ttl: 60 * 60 * 1000,
  });
}
