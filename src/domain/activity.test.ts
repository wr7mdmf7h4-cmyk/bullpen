import { describe, expect, it } from "vitest";
import { activityPayloadSchema, describeActivity } from "./activity";

describe("describeActivity", () => {
  it("celebrates buys", () => {
    const d = describeActivity("sam", {
      type: "TRADE",
      side: "BUY",
      symbol: "NVDA",
      quantity: 20,
      priceCents: 10_000,
      realizedPnlCents: null,
    });
    expect(d).toEqual({ text: "sam bought 20 NVDA", emoji: "🚀", tone: "neutral" });
  });

  it("distinguishes profitable and losing sells", () => {
    const base = { type: "TRADE" as const, side: "SELL" as const, symbol: "TSLA", quantity: 5, priceCents: 30_000 };
    expect(describeActivity("ana", { ...base, realizedPnlCents: 1_000 })).toMatchObject({ emoji: "💰", tone: "gain" });
    expect(describeActivity("ana", { ...base, realizedPnlCents: -1 })).toMatchObject({ emoji: "📉", tone: "loss" });
    expect(describeActivity("ana", { ...base, realizedPnlCents: 0 })).toMatchObject({ tone: "neutral" });
  });

  it("names achievements and joins", () => {
    expect(describeActivity("kim", { type: "ACHIEVEMENT", key: "fee_goblin" }).text).toBe("kim unlocked Fee Goblin");
    expect(describeActivity("kim", { type: "JOINED" }).text).toBe("kim joined the league");
  });

  it("validates stored payloads", () => {
    expect(activityPayloadSchema.safeParse({ type: "TRADE", side: "HOLD" }).success).toBe(false);
    expect(activityPayloadSchema.safeParse({ type: "JOINED" }).success).toBe(true);
  });
});
