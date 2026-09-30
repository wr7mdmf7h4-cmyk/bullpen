import { describe, expect, it } from "vitest";
import { getMarketHours, isMarketOpen, nyTimeToUtc, previousSessionClose, sessionOn, sessionsBetween } from "./hours";

const at = (iso: string) => new Date(iso);

describe("US market hours", () => {
  it("is open 9:30–16:00 ET on a normal weekday (EDT, UTC-4)", () => {
    // Tue 2026-09-29
    expect(isMarketOpen(at("2026-09-29T13:29:59Z"))).toBe(false);
    expect(isMarketOpen(at("2026-09-29T13:30:00Z"))).toBe(true);
    expect(isMarketOpen(at("2026-09-29T19:59:59Z"))).toBe(true);
    expect(isMarketOpen(at("2026-09-29T20:00:00Z"))).toBe(false);
  });

  it("follows daylight saving time (EST, UTC-5)", () => {
    // Tue 2026-12-01
    expect(isMarketOpen(at("2026-12-01T14:29:00Z"))).toBe(false);
    expect(isMarketOpen(at("2026-12-01T14:30:00Z"))).toBe(true);
  });

  it("is closed on weekends and holidays", () => {
    expect(isMarketOpen(at("2026-10-03T15:00:00Z"))).toBe(false); // Saturday
    expect(isMarketOpen(at("2026-11-26T16:00:00Z"))).toBe(false); // Thanksgiving
    expect(isMarketOpen(at("2026-12-25T16:00:00Z"))).toBe(false); // Christmas
  });

  it("closes at 1pm ET on early-close days", () => {
    // Black Friday 2026-11-27 (EST)
    expect(isMarketOpen(at("2026-11-27T17:59:00Z"))).toBe(true);
    expect(isMarketOpen(at("2026-11-27T18:00:00Z"))).toBe(false);
  });

  it("finds the next open across a weekend", () => {
    const status = getMarketHours(at("2026-10-02T21:00:00Z")); // Friday after close
    expect(status.isOpen).toBe(false);
    expect(status.nextOpen.toISOString()).toBe("2026-10-05T13:30:00.000Z"); // Monday
    expect(status.lastClose.toISOString()).toBe("2026-10-02T20:00:00.000Z");
  });

  it("skips holidays when finding the next open", () => {
    const status = getMarketHours(at("2026-11-25T22:00:00Z")); // Wed before Thanksgiving
    expect(status.nextOpen.toISOString()).toBe("2026-11-27T14:30:00.000Z");
  });

  it("reports the current session while open", () => {
    const status = getMarketHours(at("2026-09-29T15:00:00Z"));
    expect(status.session?.close.toISOString()).toBe("2026-09-29T20:00:00.000Z");
  });

  it("converts NY wall-clock time to UTC on both sides of DST", () => {
    expect(nyTimeToUtc({ y: 2026, m: 3, d: 6 }, 9 * 60 + 30).toISOString()).toBe("2026-03-06T14:30:00.000Z");
    expect(nyTimeToUtc({ y: 2026, m: 3, d: 9 }, 9 * 60 + 30).toISOString()).toBe("2026-03-09T13:30:00.000Z");
  });

  it("returns no session on non-trading days", () => {
    expect(sessionOn({ y: 2026, m: 7, d: 3 })).toBeNull(); // Independence Day (observed)
  });

  it("finds the previous session close", () => {
    expect(previousSessionClose(at("2026-10-05T14:00:00Z")).toISOString()).toBe("2026-10-02T20:00:00.000Z");
  });

  it("lists sessions in a range", () => {
    const sessions = sessionsBetween(at("2026-09-28T00:00:00Z"), at("2026-10-04T00:00:00Z"));
    expect(sessions).toHaveLength(5);
  });
});
