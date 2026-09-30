import { describe, expect, it } from "vitest";
import { tickerSchema, usernameLookupSchema, usernameSchema } from "./validators";

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
