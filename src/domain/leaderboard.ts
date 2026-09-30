import { ratioBps, type Bps, type Cents } from "./money";

export type LeaderboardInput = {
  userId: string;
  username: string;
  totalValueCents: Cents;
  startingCashCents: Cents;
  tradeCount: number;
  joinedAt: Date;
};

export type LeaderboardEntry = LeaderboardInput & {
  rank: number;
  returnBps: Bps;
  returnCents: Cents;
};

/**
 * Ranks players by return %. Ties share a rank ("standard competition"
 * ranking: 1, 2, 2, 4). Within a tie, display order is deterministic:
 * fewer trades first (efficiency wins), then earlier joiners, then username.
 */
export function rankLeaderboard(entries: LeaderboardInput[]): LeaderboardEntry[] {
  const scored = entries.map((e) => ({
    ...e,
    returnCents: e.totalValueCents - e.startingCashCents,
    returnBps: ratioBps(e.totalValueCents - e.startingCashCents, e.startingCashCents),
  }));
  scored.sort(
    (a, b) =>
      b.returnBps - a.returnBps ||
      a.tradeCount - b.tradeCount ||
      a.joinedAt.getTime() - b.joinedAt.getTime() ||
      a.username.localeCompare(b.username),
  );
  let rank = 0;
  return scored.map((e, i) => {
    if (i === 0 || e.returnBps !== scored[i - 1]!.returnBps) rank = i + 1;
    return { ...e, rank };
  });
}
