import { describe, expect, it } from "vitest";
import { formatDuration, INVITE_ALPHABET, inviteCodeFromBytes, leagueStatus } from "./leagues";

describe("leagueStatus", () => {
  const league = { startsAt: new Date("2026-03-01"), endsAt: new Date("2026-04-01") };
  it("is upcoming, active, then ended", () => {
    expect(leagueStatus(league, new Date("2026-02-28"))).toBe("UPCOMING");
    expect(leagueStatus(league, new Date("2026-03-01"))).toBe("ACTIVE");
    expect(leagueStatus(league, new Date("2026-04-01"))).toBe("ENDED");
  });
  it("never ends without an end date", () => {
    expect(leagueStatus({ startsAt: new Date(0), endsAt: null }, new Date("2099-01-01"))).toBe("ACTIVE");
  });
});

describe("inviteCodeFromBytes", () => {
  it("produces 8 unambiguous characters", () => {
    const code = inviteCodeFromBytes(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]));
    expect(code).toHaveLength(8);
    expect([...code].every((c) => INVITE_ALPHABET.includes(c))).toBe(true);
    expect(code).not.toMatch(/[01OIL]/);
  });
  it("needs enough randomness", () => {
    expect(() => inviteCodeFromBytes(new Uint8Array(4))).toThrow();
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0m"],
    [59_000, "1m"],
    [3 * 3_600_000 + 12 * 60_000, "3h 12m"],
    [2 * 86_400_000 + 5 * 3_600_000, "2d 5h"],
    [86_400_000, "1d"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
