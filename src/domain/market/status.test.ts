import { describe, expect, it } from "vitest";
import { canTradeNow, marketClosedMessage, marketStatus } from "./status";

describe("marketStatus", () => {
  it("is closed at the weekend and explains when it reopens", () => {
    const saturday = new Date("2026-10-03T15:00:00Z");
    const status = marketStatus(saturday);
    expect(status.state).toBe("CLOSED");
    expect(canTradeNow(status)).toBe(false);
    expect(marketClosedMessage(status, saturday)).toBe("The US market is closed. It opens in 1d 22h.");
  });

  it("is open during a session", () => {
    const status = marketStatus(new Date("2026-09-29T15:00:00Z"));
    expect(status.state).toBe("OPEN");
    expect(canTradeNow(status)).toBe(true);
    expect(marketClosedMessage(status, new Date())).toBeNull();
  });
});
