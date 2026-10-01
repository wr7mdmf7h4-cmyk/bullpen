import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { getQuote, PriceUnavailableError, usesRealQuotes } from "../market";
import { findInstrument } from "../instruments";
import { ensureReferenceData } from "../reference-data";
import { formatDuration, leagueStatus, SYSTEM_LEAGUES } from "@/domain/leagues";
import { marketClosedMessage, marketStatus } from "@/domain/market/status";
import { applyBuy, applySell, exceedsSlippage, isExecutableQuote, validateOrder, type Side } from "@/domain/trading";
import type { ActivityPayload } from "@/domain/activity";
import { formatCents } from "@/domain/money";

export type TradeErrorCode =
  | "NOT_A_MEMBER"
  | "LEAGUE_NOT_STARTED"
  | "LEAGUE_ENDED"
  | "MARKET_CLOSED"
  | "PRICE_MOVED"
  | "UNKNOWN_SYMBOL"
  | "NOT_TRADABLE"
  | "PRICE_UNAVAILABLE"
  | "INVALID_QUANTITY"
  | "ORDER_TOO_LARGE"
  | "INSUFFICIENT_FUNDS"
  | "INSUFFICIENT_SHARES"
  | "PROCEEDS_BELOW_FEE";

export class TradeError extends Error {
  constructor(
    public readonly code: TradeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TradeError";
  }
}

export type TradeRequest = {
  userId: string;
  leagueId: string;
  symbol: string;
  side: Side;
  quantity: number;
  /** price shown to the user when they confirmed (slippage guard) */
  expectedPriceCents: number;
  idempotencyKey: string;
  now?: Date;
};

export type TradeResult = {
  trade: {
    id: string;
    symbol: string;
    side: Side;
    quantity: number;
    priceCents: number;
    feeCents: number;
    netCashCents: number;
    realizedPnlCents: number | null;
    executedAt: Date;
  };
  portfolioId: string;
  cashCents: number;
  /** true when this idempotency key had already been executed */
  replayed: boolean;
};

/**
 * Executes a market order atomically.
 *
 * 1. Checks that need I/O but no lock (membership, league window, market
 *    hours, live quote, slippage) run first, so the row lock is held briefly.
 * 2. Inside one transaction we `SELECT … FOR UPDATE` the portfolio row. Every
 *    trade on that portfolio is now serialised: a concurrent request waits
 *    here and then re-reads the committed cash/holding.
 * 3. The idempotency key is checked *after* taking the lock, so a
 *    double-click's second request sees the first one's committed trade and
 *    returns it instead of trading twice. A unique index backs this up.
 * 4. Validation and position maths come from the pure domain layer.
 * 5. Postgres CHECK constraints are the last line of defence.
 */
export async function executeTrade(req: TradeRequest): Promise<TradeResult> {
  const now = req.now ?? new Date();
  await ensureReferenceData();

  let portfolio = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId: req.userId, leagueId: req.leagueId } },
    include: { league: true },
  });
  // A linked league has no portfolio of its own: trades go to the main one.
  if (portfolio?.league.portfolioMode === "LINKED") {
    portfolio = await db.portfolio.findUnique({
      where: { userId_leagueId: { userId: req.userId, leagueId: SYSTEM_LEAGUES.global.id } },
      include: { league: true },
    });
  }
  if (!portfolio) throw new TradeError("NOT_A_MEMBER", "You're not a member of this league.");
  const { league } = portfolio;

  // Idempotent replay short-circuit (no lock needed to *read* a committed trade).
  const prior = await db.trade.findUnique({
    where: { portfolioId_idempotencyKey: { portfolioId: portfolio.id, idempotencyKey: req.idempotencyKey } },
  });
  if (prior) return replay(prior, portfolio.id, portfolio.cashCents);

  const status = leagueStatus(league, now);
  if (status === "UPCOMING") {
    throw new TradeError(
      "LEAGUE_NOT_STARTED",
      `This league starts in ${formatDuration(league.startsAt.getTime() - now.getTime())}.`,
    );
  }
  if (status === "ENDED") throw new TradeError("LEAGUE_ENDED", "This league has ended. Final standings are locked in.");

  const market = marketStatus(now);
  const closedMessage = marketClosedMessage(market, now);
  if (closedMessage) {
    throw new TradeError("MARKET_CLOSED", closedMessage, {
      opensAt: market.state === "CLOSED" ? market.opensAt.toISOString() : undefined,
    });
  }

  const instrument = await findInstrument(req.symbol);
  if (!instrument) throw new TradeError("UNKNOWN_SYMBOL", `${req.symbol} isn't a US-listed stock or ETF.`);
  if (!instrument.isActive) {
    throw new TradeError("NOT_TRADABLE", `${instrument.symbol} is no longer listed and can't be traded.`);
  }

  const quote = await getQuote(instrument.symbol, now).catch((err: unknown) => {
    if (err instanceof PriceUnavailableError) {
      throw new TradeError("PRICE_UNAVAILABLE", `We couldn't get a live price for ${instrument.symbol} right now.`);
    }
    throw err;
  });
  // Never fill at a stale price: only a fresh quote from the provider counts.
  if (!isExecutableQuote(quote, { realQuotes: usesRealQuotes(), now })) {
    throw new TradeError(
      "PRICE_UNAVAILABLE",
      `We couldn't get a live price for ${instrument.symbol} right now. Please try again in a minute.`,
    );
  }
  if (exceedsSlippage(req.expectedPriceCents, quote.priceCents)) {
    throw new TradeError(
      "PRICE_MOVED",
      `The price moved to ${formatCents(quote.priceCents)}. Please review and confirm again.`,
      {
        priceCents: quote.priceCents,
      },
    );
  }

  const fees = { flatCents: league.feeFlatCents, bps: league.feeBps };

  const result = await db
    .$transaction(
      async (tx) => {
        // Serialise all trades on this portfolio.
        const locked = await tx.$queryRaw<{ cashCents: number }[]>`
        SELECT "cashCents" FROM "Portfolio" WHERE id = ${portfolio.id} FOR UPDATE`;
        const cashCents = locked[0]!.cashCents;

        const existing = await tx.trade.findUnique({
          where: { portfolioId_idempotencyKey: { portfolioId: portfolio.id, idempotencyKey: req.idempotencyKey } },
        });
        if (existing) return { kind: "replay" as const, trade: existing, cashCents };

        const holding = await tx.holding.findUnique({
          where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: quote.symbol } },
        });

        const check = validateOrder({
          side: req.side,
          quantity: req.quantity,
          priceCents: quote.priceCents,
          fees,
          cashCents,
          heldQuantity: holding?.quantity ?? 0,
        });
        if (!check.ok) throw new TradeError(check.code, check.message);
        const order = check.quote;

        let realizedPnlCents: number | null = null;
        if (req.side === "BUY") {
          const next = applyBuy(holding, order);
          await tx.holding.upsert({
            where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol: quote.symbol } },
            create: { portfolioId: portfolio.id, symbol: quote.symbol, ...next, openedAt: now },
            update: next,
          });
        } else {
          const res = applySell(holding!, order);
          realizedPnlCents = res.realizedPnlCents;
          if (res.remaining) {
            await tx.holding.update({ where: { id: holding!.id }, data: res.remaining });
          } else {
            await tx.holding.delete({ where: { id: holding!.id } });
          }
        }

        const updated = await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            cashCents: { increment: order.netCashCents },
            feesPaidCents: { increment: order.feeCents },
            tradeCount: { increment: 1 },
            ...(realizedPnlCents !== null && { realizedPnlCents: { increment: realizedPnlCents } }),
          },
          select: { cashCents: true },
        });

        const trade = await tx.trade.create({
          data: {
            portfolioId: portfolio.id,
            symbol: quote.symbol,
            side: req.side,
            quantity: order.quantity,
            priceCents: order.priceCents,
            feeCents: order.feeCents,
            netCashCents: order.netCashCents,
            realizedPnlCents,
            idempotencyKey: req.idempotencyKey,
            executedAt: now,
          },
        });

        const payload: ActivityPayload = {
          type: "TRADE",
          side: req.side,
          symbol: quote.symbol,
          quantity: order.quantity,
          priceCents: order.priceCents,
          realizedPnlCents,
        };
        // Trades in the main portfolio also count in every linked league.
        const linked =
          league.kind === "GLOBAL"
            ? await tx.portfolio.findMany({
                where: { userId: req.userId, league: { portfolioMode: "LINKED" } },
                select: { leagueId: true },
              })
            : [];
        await tx.activityEvent.createMany({
          data: [league.id, ...linked.map((l) => l.leagueId)].map((leagueId) => ({
            leagueId,
            userId: req.userId,
            type: "TRADE" as const,
            payload,
            createdAt: now,
          })),
        });

        return { kind: "filled" as const, trade, cashCents: updated.cashCents };
      },
      { maxWait: 5_000, timeout: 10_000 },
    )
    .catch(async (err: unknown) => {
      // Belt and braces: the unique index on (portfolioId, idempotencyKey)
      // turns any duplicate that slipped past the lock into a replay.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const trade = await db.trade.findUnique({
          where: { portfolioId_idempotencyKey: { portfolioId: portfolio.id, idempotencyKey: req.idempotencyKey } },
        });
        if (trade) {
          const fresh = await db.portfolio.findUniqueOrThrow({
            where: { id: portfolio.id },
            select: { cashCents: true },
          });
          return { kind: "replay" as const, trade, cashCents: fresh.cashCents };
        }
      }
      throw err;
    });

  if (result.kind === "replay") return replay(result.trade, portfolio.id, result.cashCents);

  return {
    trade: {
      id: result.trade.id,
      symbol: result.trade.symbol,
      side: result.trade.side,
      quantity: result.trade.quantity,
      priceCents: result.trade.priceCents,
      feeCents: result.trade.feeCents,
      netCashCents: result.trade.netCashCents,
      realizedPnlCents: result.trade.realizedPnlCents,
      executedAt: result.trade.executedAt,
    },
    portfolioId: portfolio.id,
    cashCents: result.cashCents,
    replayed: false,
  };
}

function replay(
  trade: {
    id: string;
    symbol: string;
    side: Side;
    quantity: number;
    priceCents: number;
    feeCents: number;
    netCashCents: number;
    realizedPnlCents: number | null;
    executedAt: Date;
  },
  portfolioId: string,
  cashCents: number,
): TradeResult {
  const { id, symbol, side, quantity, priceCents, feeCents, netCashCents, realizedPnlCents, executedAt } = trade;
  return {
    trade: { id, symbol, side, quantity, priceCents, feeCents, netCashCents, realizedPnlCents, executedAt },
    portfolioId,
    cashCents,
    replayed: true,
  };
}
