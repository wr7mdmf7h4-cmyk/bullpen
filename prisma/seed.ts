/**
 * Seeds a demo world so the app looks alive immediately:
 *   - the shared demo account + 6 bot traders (bots have no password)
 *   - Global (LIVE), 24/7 Practice (SIMULATED) and a private demo league
 *   - ~45 days of trade history, daily snapshots, activity and achievements
 *
 * Every trade goes through the same pure domain functions as real trades
 * (validateOrder / applyBuy / applySell) and uses the simulated market's
 * historical prices, so the ledger invariants hold for seeded data too.
 *
 * Idempotent: re-running wipes and recreates only seeded users and the demo
 * league. Real users are never touched.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { UNIVERSE, getInstrument, type InstrumentDef } from "../src/domain/market/universe";
import { simulatedPriceCents, simulatedQuote } from "../src/domain/market/simulated";
import { isMarketOpen } from "../src/domain/market/hours";
import { calendarFor } from "../src/domain/market/status";
import { applyBuy, applySell, validateOrder, type Position } from "../src/domain/trading";
import { valuePortfolio } from "../src/domain/portfolio";
import { newlyUnlocked, type AchievementContext } from "../src/domain/achievements";
import type { ActivityPayload } from "../src/domain/activity";
import {
  DEFAULT_FEE_BPS,
  DEFAULT_FEE_FLAT_CENTS,
  DEFAULT_STARTING_CASH_CENTS,
  SYSTEM_LEAGUES,
  SYSTEM_LEAGUE_START,
} from "../src/domain/leagues";
import { ratioBps } from "../src/domain/money";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 86_400_000;
const BOT_DOMAIN = "bots.bullpen.dev";
const DEMO_EMAIL = "demo@bullpen.dev";
const DEMO_LEAGUE_CODE = "PAPERHND";

// Deterministic PRNG so every seed run produces the same world.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260930);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!;

type Persona = {
  username: string;
  email: string;
  isDemo?: boolean;
  /** approximate trades per league */
  activity: number;
  /** fraction of cash per buy */
  sizing: [number, number];
  sectors: string[];
  /** probability of selling when holding something */
  sellBias: number;
};

const PERSONAS: Persona[] = [
  {
    username: "demo",
    email: DEMO_EMAIL,
    isDemo: true,
    activity: 22,
    sizing: [0.08, 0.2],
    sectors: ["Technology", "Communication Services", "ETF"],
    sellBias: 0.35,
  },
  {
    username: "sam",
    email: `sam@${BOT_DOMAIN}`,
    activity: 34,
    sizing: [0.15, 0.35],
    sectors: ["Technology"],
    sellBias: 0.45,
  },
  {
    username: "priya",
    email: `priya@${BOT_DOMAIN}`,
    activity: 18,
    sizing: [0.08, 0.18],
    sectors: ["Health Care", "Consumer Staples", "Financials", "Technology", "Energy"],
    sellBias: 0.25,
  },
  {
    username: "jordan",
    email: `jordan@${BOT_DOMAIN}`,
    activity: 45,
    sizing: [0.1, 0.3],
    sectors: ["Consumer Discretionary", "Financials"],
    sellBias: 0.55,
  },
  {
    username: "mei",
    email: `mei@${BOT_DOMAIN}`,
    activity: 12,
    sizing: [0.2, 0.3],
    sectors: ["ETF", "Industrials", "Utilities"],
    sellBias: 0.15,
  },
  {
    username: "diego",
    email: `diego@${BOT_DOMAIN}`,
    activity: 28,
    sizing: [0.1, 0.25],
    sectors: ["Energy", "Materials", "Industrials"],
    sellBias: 0.4,
  },
  {
    username: "ava",
    email: `ava@${BOT_DOMAIN}`,
    activity: 20,
    sizing: [0.12, 0.25],
    sectors: ["Communication Services", "Consumer Discretionary", "Technology"],
    sellBias: 0.3,
  },
];

type LeagueRow = {
  id: string;
  marketSource: "LIVE" | "SIMULATED";
  startingCashCents: number;
  feeFlatCents: number;
  feeBps: number;
};

type TradeRec = {
  portfolioId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  priceCents: number;
  feeCents: number;
  netCashCents: number;
  realizedPnlCents: number | null;
  idempotencyKey: string;
  executedAt: Date;
};

function randomTimes(from: number, to: number, n: number, source: "LIVE" | "SIMULATED") {
  const times: number[] = [];
  let guard = 0;
  while (times.length < n && guard++ < n * 200) {
    const t = Math.floor(from + rng() * (to - from));
    if (source === "LIVE" && !isMarketOpen(new Date(t))) continue;
    times.push(t);
  }
  return times.sort((a, b) => a - b);
}

function candidateSymbols(persona: Persona): InstrumentDef[] {
  const preferred = UNIVERSE.filter((i) => persona.sectors.includes(i.sector));
  return rng() < 0.75 && preferred.length ? preferred : [...UNIVERSE];
}

async function main() {
  const now = new Date();
  console.log("🌱 Seeding Bullpen…");

  // ── reference data ───────────────────────────────────────────────────────
  await db.instrument.createMany({
    data: UNIVERSE.map(({ symbol, name, sector, exchange }) => ({ symbol, name, sector, exchange })),
    skipDuplicates: true,
  });
  for (const league of Object.values(SYSTEM_LEAGUES)) {
    await db.league.upsert({
      where: { id: league.id },
      update: {},
      create: {
        ...league,
        startsAt: SYSTEM_LEAGUE_START,
        startingCashCents: DEFAULT_STARTING_CASH_CENTS,
        feeFlatCents: DEFAULT_FEE_FLAT_CENTS,
        feeBps: DEFAULT_FEE_BPS,
        maxMembers: 1_000_000,
      },
    });
  }

  // ── wipe previous seed ───────────────────────────────────────────────────
  await db.league.deleteMany({ where: { inviteCode: DEMO_LEAGUE_CODE } });
  await db.user.deleteMany({ where: { OR: [{ email: DEMO_EMAIL }, { email: { endsWith: `@${BOT_DOMAIN}` } }] } });

  // ── users ────────────────────────────────────────────────────────────────
  const users = [];
  for (const p of PERSONAS) {
    users.push(
      await db.user.create({
        data: {
          email: p.email,
          username: p.username,
          avatarSeed: p.isDemo ? "demo-bull" : `${p.username}-bot`,
          isDemo: Boolean(p.isDemo),
          createdAt: new Date(now.getTime() - 50 * DAY),
        },
      }),
    );
  }

  const demoLeague = await db.league.create({
    data: {
      name: "Paper Hands Club",
      kind: "PRIVATE",
      marketSource: "SIMULATED",
      inviteCode: DEMO_LEAGUE_CODE,
      ownerId: users[1]!.id, // sam hosts
      startsAt: new Date(now.getTime() - 40 * DAY),
      endsAt: new Date(now.getTime() + 20 * DAY),
      startingCashCents: DEFAULT_STARTING_CASH_CENTS,
      feeFlatCents: DEFAULT_FEE_FLAT_CENTS,
      feeBps: DEFAULT_FEE_BPS,
    },
  });

  const leagues = (await db.league.findMany({
    where: { id: { in: [SYSTEM_LEAGUES.global.id, SYSTEM_LEAGUES.practice.id, demoLeague.id] } },
  })) as LeagueRow[];

  let tradeTotal = 0;
  for (const [ui, persona] of PERSONAS.entries()) {
    const user = users[ui]!;
    const allTrades: (TradeRec & { leagueId: string })[] = [];
    const finalStates: {
      leagueId: string;
      portfolioId: string;
      cash: number;
      positions: Map<string, Position & { openedAt: number }>;
      startingCash: number;
      source: "LIVE" | "SIMULATED";
    }[] = [];

    for (const league of leagues) {
      const joinedAt =
        league.id === demoLeague.id ? demoLeague.startsAt.getTime() + ui * 3_600_000 : now.getTime() - (45 - ui) * DAY;
      const portfolio = await db.portfolio.create({
        data: {
          userId: user.id,
          leagueId: league.id,
          cashCents: league.startingCashCents,
          joinedAt: new Date(joinedAt),
        },
      });

      const fees = { flatCents: league.feeFlatCents, bps: league.feeBps };
      let cash = league.startingCashCents;
      let feesPaid = 0;
      let realized = 0;
      const positions = new Map<string, Position & { openedAt: number }>();
      const trades: TradeRec[] = [];
      const coreSymbols = new Set<string>();

      const n = Math.max(4, Math.round(persona.activity * (0.7 + rng() * 0.6)));
      for (const t of randomTimes(joinedAt + 3_600_000, now.getTime() - 2 * 3_600_000, n, league.marketSource)) {
        const sellable = [...positions.keys()].filter((s) => !coreSymbols.has(s));
        const side = sellable.length && rng() < persona.sellBias ? "SELL" : "BUY";

        if (side === "BUY") {
          const def = pick(candidateSymbols(persona));
          const price = simulatedPriceCents(def, t);
          const budget = cash * (persona.sizing[0] + rng() * (persona.sizing[1] - persona.sizing[0]));
          const quantity = Math.max(1, Math.floor(budget / price));
          const check = validateOrder({ side, quantity, priceCents: price, fees, cashCents: cash, heldQuantity: 0 });
          if (!check.ok) continue;
          const prev = positions.get(def.symbol);
          const next = applyBuy(prev ?? null, check.quote);
          positions.set(def.symbol, { ...next, openedAt: prev?.openedAt ?? t });
          // Each player's first buy is a long-term "core" holding (→ Diamond Hands).
          if (trades.length === 0) coreSymbols.add(def.symbol);
          cash += check.quote.netCashCents;
          feesPaid += check.quote.feeCents;
          trades.push({
            portfolioId: portfolio.id,
            symbol: def.symbol,
            side,
            quantity,
            priceCents: price,
            feeCents: check.quote.feeCents,
            netCashCents: check.quote.netCashCents,
            realizedPnlCents: null,
            idempotencyKey: crypto.randomUUID(),
            executedAt: new Date(t),
          });
        } else {
          const symbol = pick(sellable);
          const pos = positions.get(symbol)!;
          const price = simulatedPriceCents(getInstrument(symbol)!, t);
          const quantity = rng() < 0.6 ? pos.quantity : Math.max(1, Math.floor(pos.quantity * rng()));
          const check = validateOrder({
            side,
            quantity,
            priceCents: price,
            fees,
            cashCents: cash,
            heldQuantity: pos.quantity,
          });
          if (!check.ok) continue;
          const res = applySell(pos, check.quote);
          if (res.remaining) positions.set(symbol, { ...res.remaining, openedAt: pos.openedAt });
          else positions.delete(symbol);
          cash += check.quote.netCashCents;
          feesPaid += check.quote.feeCents;
          realized += res.realizedPnlCents;
          trades.push({
            portfolioId: portfolio.id,
            symbol,
            side,
            quantity,
            priceCents: price,
            feeCents: check.quote.feeCents,
            netCashCents: check.quote.netCashCents,
            realizedPnlCents: res.realizedPnlCents,
            idempotencyKey: crypto.randomUUID(),
            executedAt: new Date(t),
          });
        }
      }

      await db.trade.createMany({ data: trades });
      if (positions.size) {
        await db.holding.createMany({
          data: [...positions.entries()].map(([symbol, p]) => ({
            portfolioId: portfolio.id,
            symbol,
            quantity: p.quantity,
            costBasisCents: p.costBasisCents,
            openedAt: new Date(p.openedAt),
          })),
        });
      }
      await db.portfolio.update({
        where: { id: portfolio.id },
        data: { cashCents: cash, feesPaidCents: feesPaid, realizedPnlCents: realized, tradeCount: trades.length },
      });

      // Activity events for every trade + a join event.
      await db.activityEvent.createMany({
        data: [
          {
            leagueId: league.id,
            userId: user.id,
            type: "JOINED" as const,
            payload: { type: "JOINED" } satisfies ActivityPayload,
            createdAt: new Date(joinedAt),
          },
          ...trades.map((t) => ({
            leagueId: league.id,
            userId: user.id,
            type: "TRADE" as const,
            payload: {
              type: "TRADE",
              side: t.side,
              symbol: t.symbol,
              quantity: t.quantity,
              priceCents: t.priceCents,
              realizedPnlCents: t.realizedPnlCents,
            } satisfies ActivityPayload,
            createdAt: t.executedAt,
          })),
        ],
      });

      // Daily snapshots, replaying the ledger up to each day's end.
      const calendar = calendarFor(league.marketSource);
      const snapshots = [];
      for (let day = joinedAt; day <= now.getTime(); day += DAY) {
        const at = Math.min(day, now.getTime());
        let c = league.startingCashCents;
        const held = new Map<string, Position>();
        for (const t of trades) {
          if (t.executedAt.getTime() > at) break;
          const q = {
            side: t.side,
            quantity: t.quantity,
            priceCents: t.priceCents,
            notionalCents: t.quantity * t.priceCents,
            feeCents: t.feeCents,
            totalCents: Math.abs(t.netCashCents),
            netCashCents: t.netCashCents,
          };
          c += t.netCashCents;
          if (t.side === "BUY") held.set(t.symbol, applyBuy(held.get(t.symbol) ?? null, q));
          else {
            const r = applySell(held.get(t.symbol)!, q);
            if (r.remaining) held.set(t.symbol, r.remaining);
            else held.delete(t.symbol);
          }
        }
        const prices = new Map(
          [...held.keys()].map((s) => [s, simulatedQuote(getInstrument(s)!, calendar, new Date(at)).priceCents]),
        );
        const v = valuePortfolio(
          c,
          [...held.entries()].map(([symbol, p]) => ({ symbol, ...p })),
          prices,
          league.startingCashCents,
        );
        snapshots.push({
          portfolioId: portfolio.id,
          takenAt: new Date(at),
          totalValueCents: v.totalValueCents,
          cashCents: c,
        });
      }
      await db.portfolioSnapshot.createMany({ data: snapshots, skipDuplicates: true });

      tradeTotal += trades.length;
      allTrades.push(...trades.map((t) => ({ ...t, leagueId: league.id })));
      finalStates.push({
        leagueId: league.id,
        portfolioId: portfolio.id,
        cash,
        positions,
        startingCash: league.startingCashCents,
        source: league.marketSource,
      });
    }

    // ── achievements, unlocked at the trade that earned them ────────────────
    allTrades.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());
    const unlocked: { key: string; at: Date }[] = [];
    const have = new Set<string>();
    const perDay = new Map<string, number>();
    let fees = 0;
    let profitable = 0;
    let maxNotional = 0;
    for (const [i, t] of allTrades.entries()) {
      fees += t.feeCents;
      if ((t.realizedPnlCents ?? 0) > 0) profitable++;
      maxNotional = Math.max(maxNotional, t.quantity * t.priceCents);
      const dayKey = t.executedAt.toISOString().slice(0, 10);
      perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
      const ctx: AchievementContext = {
        now: t.executedAt,
        totalTrades: i + 1,
        profitableSells: profitable,
        totalFeesPaidCents: fees,
        maxTradeNotionalCents: maxNotional,
        maxTradesInOneDay: Math.max(...perDay.values()),
        maxSectorsHeld: 0,
        oldestOpenPositionAt: null,
        leaguesCreated: 0,
        bestReturnBps: 0,
      };
      for (const key of newlyUnlocked(ctx, have)) {
        have.add(key);
        unlocked.push({ key, at: t.executedAt });
      }
    }
    // Position- and return-based badges, evaluated on the final state.
    const finalCtx: AchievementContext = {
      now,
      totalTrades: allTrades.length,
      profitableSells: profitable,
      totalFeesPaidCents: fees,
      maxTradeNotionalCents: maxNotional,
      maxTradesInOneDay: perDay.size ? Math.max(...perDay.values()) : 0,
      maxSectorsHeld: Math.max(
        0,
        ...finalStates.map(
          (s) => new Set([...s.positions.keys()].map((k) => getInstrument(k)!.sector).filter((x) => x !== "ETF")).size,
        ),
      ),
      oldestOpenPositionAt: (() => {
        const opened = finalStates.flatMap((s) => [...s.positions.values()].map((p) => p.openedAt));
        return opened.length ? new Date(Math.min(...opened)) : null;
      })(),
      leaguesCreated: ui === 1 ? 1 : 0,
      bestReturnBps: Math.max(
        ...finalStates.map((s) => {
          const prices = new Map(
            [...s.positions.keys()].map((k) => [
              k,
              simulatedQuote(getInstrument(k)!, calendarFor(s.source), now).priceCents,
            ]),
          );
          const v = valuePortfolio(
            s.cash,
            [...s.positions.entries()].map(([symbol, p]) => ({ symbol, ...p })),
            prices,
            s.startingCash,
          );
          return ratioBps(v.totalValueCents - s.startingCash, s.startingCash);
        }),
      ),
    };
    for (const key of newlyUnlocked(finalCtx, have)) {
      unlocked.push({ key, at: new Date(now.getTime() - Math.floor(rng() * 5 * DAY)) });
    }
    if (unlocked.length) {
      await db.userAchievement.createMany({
        data: unlocked.map((u) => ({ userId: user.id, achievementKey: u.key, unlockedAt: u.at })),
      });
      await db.activityEvent.createMany({
        data: leagues.flatMap((l) =>
          unlocked.map((u) => ({
            leagueId: l.id,
            userId: user.id,
            type: "ACHIEVEMENT" as const,
            payload: { type: "ACHIEVEMENT", key: u.key } satisfies ActivityPayload,
            createdAt: u.at,
          })),
        ),
      });
    }
    console.log(`   @${persona.username}: ${allTrades.length} trades, ${unlocked.length} badges`);
  }

  console.log(
    `✅ Seeded ${PERSONAS.length} players, ${tradeTotal} trades. Demo league invite code: ${DEMO_LEAGUE_CODE}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
