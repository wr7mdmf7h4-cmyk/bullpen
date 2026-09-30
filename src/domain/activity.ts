import { z } from "zod";
import { getAchievement } from "./achievements";

/** Activity feed payloads. Stored as JSON, validated on the way in and out. */
export const activityPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TRADE"),
    side: z.enum(["BUY", "SELL"]),
    symbol: z.string(),
    quantity: z.number().int().positive(),
    priceCents: z.number().int().positive(),
    realizedPnlCents: z.number().int().nullable(),
  }),
  z.object({ type: z.literal("ACHIEVEMENT"), key: z.string() }),
  z.object({ type: z.literal("JOINED") }),
]);

export type ActivityPayload = z.infer<typeof activityPayloadSchema>;

export type ActivityTone = "gain" | "loss" | "neutral" | "celebrate";

export function describeActivity(
  username: string,
  payload: ActivityPayload,
): { text: string; emoji: string; tone: ActivityTone } {
  switch (payload.type) {
    case "TRADE": {
      const shares = `${payload.quantity} ${payload.symbol}`;
      if (payload.side === "BUY") {
        return { text: `${username} bought ${shares}`, emoji: "🚀", tone: "neutral" };
      }
      const pnl = payload.realizedPnlCents ?? 0;
      if (pnl > 0) return { text: `${username} sold ${shares} for a profit`, emoji: "💰", tone: "gain" };
      if (pnl < 0) return { text: `${username} sold ${shares} at a loss`, emoji: "📉", tone: "loss" };
      return { text: `${username} sold ${shares}`, emoji: "🤝", tone: "neutral" };
    }
    case "ACHIEVEMENT": {
      const a = getAchievement(payload.key);
      return {
        text: `${username} unlocked ${a?.name ?? "an achievement"}`,
        emoji: a?.emoji ?? "🏆",
        tone: "celebrate",
      };
    }
    case "JOINED":
      return { text: `${username} joined the league`, emoji: "👋", tone: "neutral" };
  }
}
