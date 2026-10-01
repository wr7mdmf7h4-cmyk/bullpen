import { describe, expect, it } from "vitest";
import { profileSchema, tickerSchema, usernameLookupSchema, usernameSchema } from "./validators";

describe("usernames", () => {
  it("normalises case and whitespace", () => {
    expect(usernameSchema.parse("  Wolf_Of_Main ")).toBe("wolf_of_main");
  });

  it("rejects bad formats", () => {
    for (const bad of ["ab", "has space", "émoji", "a".repeat(21), "dash-name"]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("stops people *choosing* reserved names", () => {
    expect(usernameSchema.safeParse("demo").success).toBe(false);
    expect(usernameSchema.safeParse("admin").success).toBe(false);
  });

  it("still lets existing reserved accounts be looked up (e.g. /u/demo)", () => {
    expect(usernameLookupSchema.parse("demo")).toBe("demo");
    expect(usernameLookupSchema.parse("Demo")).toBe("demo");
  });
});

describe("tickerSchema", () => {
  it("accepts plain tickers and share classes", () => {
    expect(tickerSchema.parse("aapl")).toBe("AAPL");
    expect(tickerSchema.parse("brk.b")).toBe("BRK.B");
  });

  it("rejects junk", () => {
    for (const bad of ["", "TOOLONG", "BRK.BB", "AB$C", "1234"]) {
      expect(tickerSchema.safeParse(bad).success).toBe(false);
    }
  });
});

const base = {
  displayName: "",
  bio: "",
  avatarStyle: "pixel-art",
  avatarSeed: "abc123",
  accentColor: null,
  favoriteSymbol: "",
  featuredBadge: null,
};

describe("profileSchema", () => {
  it("turns empty fields into nulls", () => {
    const out = profileSchema.parse(base);
    expect(out).toMatchObject({ displayName: null, bio: null, favoriteSymbol: null, accentColor: null });
  });

  it("strips invisible characters and squashes whitespace in names", () => {
    const out = profileSchema.parse({ ...base, displayName: "  Krish​   the\nTrader\u0007 " });
    expect(out.displayName).toBe("Krish the Trader");
  });

  it("keeps single line breaks in bios but not runs of them", () => {
    expect(profileSchema.parse({ ...base, bio: "Long NVDA\n\n\n\nShort sleep" }).bio).toBe("Long NVDA\n\nShort sleep");
  });

  it("limits lengths", () => {
    expect(profileSchema.safeParse({ ...base, displayName: "x".repeat(31) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, bio: "x".repeat(161) }).success).toBe(false);
  });

  it("normalises tickers and rejects junk", () => {
    expect(profileSchema.parse({ ...base, favoriteSymbol: " brk.b " }).favoriteSymbol).toBe("BRK.B");
    expect(profileSchema.safeParse({ ...base, favoriteSymbol: "not a ticker" }).success).toBe(false);
  });

  it("only accepts known avatar styles, safe seeds and known colours", () => {
    expect(profileSchema.safeParse({ ...base, avatarStyle: "evil" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, avatarSeed: "../../etc" }).success).toBe(false);
    expect(profileSchema.parse({ ...base, accentColor: "violet" }).accentColor).toBe("violet");
    expect(profileSchema.parse({ ...base, accentColor: "neon" }).accentColor).toBeNull();
  });
});
