import { describe, expect, it } from "vitest";
import { dailyCounts, dayKey, isAdminEmail, parseAdminEmails } from "./admin";

describe("admin emails", () => {
  it("parses a comma-separated list, ignoring case and blanks", () => {
    const admins = parseAdminEmails(" Me@Example.com, ,other@example.com ");
    expect([...admins]).toEqual(["me@example.com", "other@example.com"]);
  });

  it("matches case-insensitively", () => {
    const admins = parseAdminEmails("me@example.com");
    expect(isAdminEmail("ME@example.com", admins)).toBe(true);
    expect(isAdminEmail("someone@example.com", admins)).toBe(false);
  });

  it("lets nobody in when unset", () => {
    expect(isAdminEmail("me@example.com", parseAdminEmails(undefined))).toBe(false);
    expect(isAdminEmail("", parseAdminEmails(""))).toBe(false);
  });
});

describe("dayKey", () => {
  it("uses the given time zone", () => {
    // 23:30 UTC in summer is 00:30 the next day in London
    expect(dayKey(new Date("2026-07-01T23:30:00Z"), "Europe/London")).toBe("2026-07-02");
    expect(dayKey(new Date("2026-07-01T23:30:00Z"), "UTC")).toBe("2026-07-01");
  });
});

describe("dailyCounts", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("returns one bucket per day, oldest first, including empty days", () => {
    const counts = dailyCounts(
      [new Date("2026-10-01T08:00:00Z"), new Date("2026-10-01T09:00:00Z"), new Date("2026-09-29T10:00:00Z")],
      now,
      3,
      "Europe/London",
    );
    expect(counts).toEqual([
      { day: "2026-09-29", count: 1 },
      { day: "2026-09-30", count: 0 },
      { day: "2026-10-01", count: 2 },
    ]);
  });

  it("ignores dates outside the window", () => {
    const counts = dailyCounts([new Date("2026-09-01T10:00:00Z")], now, 7, "Europe/London");
    expect(counts.reduce((n, d) => n + d.count, 0)).toBe(0);
    expect(counts).toHaveLength(7);
  });

  it("spans month ends and DST changes without gaps", () => {
    const counts = dailyCounts([], new Date("2026-10-26T12:00:00Z"), 3, "Europe/London");
    expect(counts.map((d) => d.day)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });
});
