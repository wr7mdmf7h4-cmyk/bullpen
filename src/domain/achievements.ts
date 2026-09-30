/**
 * Achievements are defined in code (type-checked, versioned, no migration to
 * add one). The database only records which user unlocked which key and when.
 */

export type AchievementContext = {
  now: Date;
  totalTrades: number;
  profitableSells: number;
  totalFeesPaidCents: number;
  maxTradeNotionalCents: number;
  maxTradesInOneDay: number;
  /** most distinct non-ETF sectors held at once in any single portfolio */
  maxSectorsHeld: number;
  /** earliest openedAt across all currently open positions */
  oldestOpenPositionAt: Date | null;
  leaguesCreated: number;
  bestReturnBps: number;
};

export type AchievementDef = {
  key: string;
  name: string;
  emoji: string;
  description: string;
  isUnlocked: (ctx: AchievementContext) => boolean;
};

const DAY_MS = 86_400_000;

export const DIAMOND_HANDS_DAYS = 30;
export const DIVERSIFIED_SECTORS = 5;
export const FEE_GOBLIN_CENTS = 10_000; // $100
export const HIGH_ROLLER_CENTS = 500_000; // $5,000
export const DAY_TRADER_TRADES = 10;
export const TO_THE_MOON_BPS = 1_000; // +10%

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    key: "first_trade",
    name: "First Trade",
    emoji: "🎯",
    description: "Place your first trade.",
    isUnlocked: (c) => c.totalTrades >= 1,
  },
  {
    key: "in_the_green",
    name: "In the Green",
    emoji: "💸",
    description: "Close a position for a profit.",
    isUnlocked: (c) => c.profitableSells >= 1,
  },
  {
    key: "diamond_hands",
    name: "Diamond Hands",
    emoji: "💎",
    description: `Hold a position for ${DIAMOND_HANDS_DAYS} days.`,
    isUnlocked: (c) =>
      c.oldestOpenPositionAt !== null &&
      c.now.getTime() - c.oldestOpenPositionAt.getTime() >= DIAMOND_HANDS_DAYS * DAY_MS,
  },
  {
    key: "diversified",
    name: "Diversified",
    emoji: "🌈",
    description: `Hold stocks from ${DIVERSIFIED_SECTORS}+ sectors at once.`,
    isUnlocked: (c) => c.maxSectorsHeld >= DIVERSIFIED_SECTORS,
  },
  {
    key: "fee_goblin",
    name: "Fee Goblin",
    emoji: "👺",
    description: "Pay $100 in trading fees. The house thanks you.",
    isUnlocked: (c) => c.totalFeesPaidCents >= FEE_GOBLIN_CENTS,
  },
  {
    key: "high_roller",
    name: "High Roller",
    emoji: "🎲",
    description: "Place a single trade worth $5,000 or more.",
    isUnlocked: (c) => c.maxTradeNotionalCents >= HIGH_ROLLER_CENTS,
  },
  {
    key: "day_trader",
    name: "Day Trader",
    emoji: "⚡",
    description: `Make ${DAY_TRADER_TRADES} trades in a single day.`,
    isUnlocked: (c) => c.maxTradesInOneDay >= DAY_TRADER_TRADES,
  },
  {
    key: "league_founder",
    name: "League Founder",
    emoji: "🏟️",
    description: "Create a private league.",
    isUnlocked: (c) => c.leaguesCreated >= 1,
  },
  {
    key: "to_the_moon",
    name: "To the Moon",
    emoji: "🚀",
    description: "Reach a +10% return in any league.",
    isUnlocked: (c) => c.bestReturnBps >= TO_THE_MOON_BPS,
  },
];

const BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

export function getAchievement(key: string): AchievementDef | undefined {
  return BY_KEY.get(key);
}

/** Returns the keys that are unlocked by `ctx` but not yet in `alreadyUnlocked`. */
export function newlyUnlocked(ctx: AchievementContext, alreadyUnlocked: Iterable<string>): string[] {
  const have = new Set(alreadyUnlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.isUnlocked(ctx)).map((a) => a.key);
}
