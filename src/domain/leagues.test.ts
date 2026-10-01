import { describe, expect, it } from "vitest";
import { formatDuration, INVITE_ALPHABET, inviteCodeFromBytes, leagueStatus, pickActiveLeague } from "./leagues";

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

describe("pickActiveLeague", () => {
  const global = { leagueId: "global", joinedAt: new Date("2026-09-30T14:18:00Z"), lastTradeAt: null };
  const family = {
    leagueId: "family",
    joinedAt: new Date("2026-09-30T14:30:00Z"),
    lastTradeAt: new Date("2026-09-30T15:00:00Z"),
  };
  const office = { leagueId: "office", joinedAt: new Date("2026-09-30T16:00:00Z"), lastTradeAt: null };

  it("uses the league the user picked", () => {
    expect(pickActiveLeague([global, family, office], "global")).toBe("global");
  });

  it("falls back to the league with the latest trade or join", () => {
    expect(pickActiveLeague([global, family], null)).toBe("family");
    expect(pickActiveLeague([global, family, office], null)).toBe("office");
  });

  it("ignores a saved league the user is no longer in", () => {
    expect(pickActiveLeague([global, family], "left-long-ago")).toBe("family");
  });

  it("prefers the earlier entry on a tie (system leagues come first)", () => {
    const twin = { ...global, leagueId: "twin" };
    expect(pickActiveLeague([global, twin], null)).toBe("global");
  });
});
