import { describe, expect, it } from "vitest";
import { canTradeNow, marketClosedMessage, marketStatus } from "./status";

describe("marketStatus", () => {
  const saturday = new Date("2026-10-03T15:00:00Z");
  it("is always open for simulated leagues", () => {
    expect(marketStatus("SIMULATED", saturday)).toEqual({ state: "ALWAYS_OPEN" });
    expect(canTradeNow(marketStatus("SIMULATED", saturday))).toBe(true);
  });

  it("follows NYSE hours for live leagues and explains when it reopens", () => {
    const status = marketStatus("LIVE", saturday);
    expect(status.state).toBe("CLOSED");
    expect(canTradeNow(status)).toBe(false);
    expect(marketClosedMessage(status, saturday)).toBe("The US market is closed. It opens in 1d 22h.");
  });

  it("is open during a live session", () => {
    const status = marketStatus("LIVE", new Date("2026-09-29T15:00:00Z"));
    expect(status.state).toBe("OPEN");
    expect(marketClosedMessage(status, new Date())).toBeNull();
  });
});
