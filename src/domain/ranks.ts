/** Rank titles earned by return %. Thresholds are in basis points. */

export type RankTitle = {
  title: "Intern" | "Analyst" | "Trader" | "Whale";
  emoji: string;
  /** inclusive lower bound (bps); null = no lower bound */
  minBps: number | null;
};

export const RANK_TITLES: readonly RankTitle[] = [
  { title: "Intern", emoji: "☕", minBps: null },
  { title: "Analyst", emoji: "📊", minBps: 0 },
  { title: "Trader", emoji: "📈", minBps: 500 },
  { title: "Whale", emoji: "🐋", minBps: 2_000 },
];

export function rankTitle(returnBps: number): RankTitle {
  let current = RANK_TITLES[0]!;
  for (const rank of RANK_TITLES) {
    if (rank.minBps === null || returnBps >= rank.minBps) current = rank;
  }
  return current;
}

/** The next title up and how many bps are needed to reach it, or null at the top. */
export function nextRank(returnBps: number): { rank: RankTitle; bpsToGo: number } | null {
  const current = rankTitle(returnBps);
  const idx = RANK_TITLES.indexOf(current);
  const next = RANK_TITLES[idx + 1];
  if (!next || next.minBps === null) return null;
  return { rank: next, bpsToGo: next.minBps - returnBps };
}
