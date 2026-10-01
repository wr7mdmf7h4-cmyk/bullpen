import { describe, expect, it } from "vitest";
import {
  deviceType,
  fillBuckets,
  hourKey,
  isBot,
  lastHours,
  normalizePath,
  referrerHost,
  shouldTrackPath,
} from "./analytics";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

describe("isBot", () => {
  it("spots crawlers, previews and headless browsers", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/140.0")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot("")).toBe(true);
  });
  it("lets real browsers through", () => {
    expect(isBot(IPHONE)).toBe(false);
    expect(isBot(MAC)).toBe(false);
  });
});

describe("deviceType", () => {
  it("tells phones, tablets and computers apart", () => {
    expect(deviceType(IPHONE)).toBe("mobile");
    expect(deviceType(ANDROID_PHONE)).toBe("mobile");
    expect(deviceType(IPAD)).toBe("tablet");
    expect(deviceType(MAC)).toBe("desktop");
  });
});

describe("paths", () => {
  it("drops query strings, hashes and trailing slashes", () => {
    expect(normalizePath("/stocks/NVDA?range=1D#chart")).toBe("/stocks/NVDA");
    expect(normalizePath("/leagues/")).toBe("/leagues");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("not-a-path")).toBeNull();
    expect(normalizePath("/" + "x".repeat(500))).toHaveLength(200);
  });
  it("skips admin, API and asset paths", () => {
    expect(shouldTrackPath("/admin")).toBe(false);
    expect(shouldTrackPath("/api/quotes")).toBe(false);
    expect(shouldTrackPath("/avatar/x")).toBe(false);
    expect(shouldTrackPath("/_next/static/x.js")).toBe(false);
    expect(shouldTrackPath("/administrator")).toBe(true);
    expect(shouldTrackPath("/dashboard")).toBe(true);
  });
});

describe("referrerHost", () => {
  it("keeps only another site's host name", () => {
    expect(referrerHost("https://www.google.com/search?q=bullpen", "bullpen.site")).toBe("google.com");
    expect(referrerHost("https://t.co/abc", "bullpen.site")).toBe("t.co");
    expect(referrerHost("https://bullpen.site/markets", "bullpen.site")).toBeNull();
    expect(referrerHost("https://www.bullpen.site/", "bullpen.site")).toBeNull();
    expect(referrerHost("", "bullpen.site")).toBeNull();
    expect(referrerHost("garbage", "bullpen.site")).toBeNull();
  });
});

describe("fillBuckets", () => {
  it("lists every bucket in order, filling gaps with zeros", () => {
    const rows = [{ bucket: "b", views: 3, visitors: 2 }];
    expect(fillBuckets(["a", "b", "c"], rows)).toEqual([
      { bucket: "a", views: 0, visitors: 0 },
      { bucket: "b", views: 3, visitors: 2 },
      { bucket: "c", views: 0, visitors: 0 },
    ]);
  });
});

describe("hours", () => {
  it("formats an hour in the given time zone", () => {
    expect(hourKey(new Date("2026-07-01T23:30:00Z"), "Europe/London")).toBe("2026-07-02 00");
  });
  it("lists the last 24 clock hours ending now", () => {
    const keys = lastHours(new Date("2026-10-01T10:15:00Z"), 24, "Europe/London");
    expect(keys).toHaveLength(24);
    expect(keys.at(-1)).toBe("2026-10-01 11");
    expect(keys[0]).toBe("2026-09-30 12");
  });
});
