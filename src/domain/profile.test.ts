import { describe, expect, it } from "vitest";
import { ACCENTS, AVATAR_STYLES, accentColor, avatarValue, DEFAULT_AVATAR_STYLE, parseAvatar } from "./profile";

describe("avatar values", () => {
  it("round-trips a style and seed", () => {
    expect(parseAvatar(avatarValue("pixel-art", "abc123"))).toEqual({ style: "pixel-art", seed: "abc123" });
  });

  it("treats a plain seed (accounts made before styles) as the original robot style", () => {
    expect(parseAvatar("krobro")).toEqual({ style: DEFAULT_AVATAR_STYLE, seed: "krobro" });
  });

  it("falls back to the default style for an unknown style", () => {
    expect(parseAvatar("not-a-style~abc")).toEqual({ style: DEFAULT_AVATAR_STYLE, seed: "abc" });
  });

  it("offers each style once", () => {
    const ids = AVATAR_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_AVATAR_STYLE);
  });
});

describe("accent colours", () => {
  it("resolves a known accent and ignores unknown ones", () => {
    expect(accentColor(ACCENTS[1]!.id)).toBe(ACCENTS[1]!.color);
    expect(accentColor("hot-pink-neon")).toBeNull();
    expect(accentColor(null)).toBeNull();
  });
});
