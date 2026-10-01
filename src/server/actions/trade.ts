"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { evaluateAchievements, type UnlockedAchievement } from "../achievements";
import { db } from "../db";
import { invalidateLeaderboard } from "../leaderboard";
import { recordSnapshot } from "../portfolio";
import { rateLimit } from "../rate-limit";
import { notifyLeague } from "../realtime";
import { executeTrade, TradeError, type TradeErrorCode } from "../trading/execute";
import { requireUser } from "../users";
import { tradeSchema } from "@/lib/validators";

export type PlaceTradeResult =
  | {
      ok: true;
      data: {
        side: "BUY" | "SELL";
        symbol: string;
        quantity: number;
        priceCents: number;
        feeCents: number;
        netCashCents: number;
        realizedPnlCents: number | null;
        cashCents: number;
        replayed: boolean;
        achievements: UnlockedAchievement[];
      };
    }
  | { ok: false; error: string; code?: TradeErrorCode | "RATE_LIMITED" | "INVALID"; priceCents?: number };

/** Server Action entry point for placing a market order. */
export async function placeTradeAction(input: z.input<typeof tradeSchema>): Promise<PlaceTradeResult> {
  const user = await requireUser();

  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }

  const limit = await rateLimit("trade", user.id);
  if (!limit.ok) {
    return { ok: false, code: "RATE_LIMITED", error: `Slow down! Try again in ${limit.retryAfterSeconds}s.` };
  }

  try {
    const now = new Date();
    const result = await executeTrade({ ...parsed.data, userId: user.id, now });

    let achievements: UnlockedAchievement[] = [];
    if (!result.replayed) {
      // Post-commit side effects. None of these can undo the trade, and a
      // failure here must not surface as a failed order.
      await recordSnapshot(result.portfolioId, now).catch((e) => console.error("[trade] snapshot failed", e));
      achievements = await evaluateAchievements(user.id, now).catch((e) => {
        console.error("[trade] achievements failed", e);
        return [];
      });
      // The trade's league, plus every linked league that follows this portfolio.
      const linked = await db.portfolio
        .findMany({ where: { userId: user.id, league: { portfolioMode: "LINKED" } }, select: { leagueId: true } })
        .catch(() => []);
      for (const leagueId of new Set([parsed.data.leagueId, ...linked.map((l) => l.leagueId)])) {
        invalidateLeaderboard(leagueId);
        await notifyLeague(leagueId, "activity");
      }
    }
    revalidatePath("/", "layout");

    return {
      ok: true,
      data: {
        side: result.trade.side,
        symbol: result.trade.symbol,
        quantity: result.trade.quantity,
        priceCents: result.trade.priceCents,
        feeCents: result.trade.feeCents,
        netCashCents: result.trade.netCashCents,
        realizedPnlCents: result.trade.realizedPnlCents,
        cashCents: result.cashCents,
        replayed: result.replayed,
        achievements,
      },
    };
  } catch (err) {
    if (err instanceof TradeError) {
      const priceCents = typeof err.details?.priceCents === "number" ? err.details.priceCents : undefined;
      return { ok: false, code: err.code, error: err.message, priceCents };
    }
    console.error("[trade] unexpected error", err);
    return { ok: false, error: "Something went wrong placing your order. Your balance was not changed." };
  }
}
