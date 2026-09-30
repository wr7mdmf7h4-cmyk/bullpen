import { describe, expect, it } from "vitest";
import { getInstrument, isKnownSymbol, searchUniverse, SECTORS, UNIVERSE } from "./universe";

describe("universe", () => {
  it("has ~50 unique, uppercase symbols with valid sectors", () => {
    expect(UNIVERSE.length).toBeGreaterThanOrEqual(50);
    expect(new Set(UNIVERSE.map((i) => i.symbol)).size).toBe(UNIVERSE.length);
    for (const i of UNIVERSE) {
      expect(i.symbol).toMatch(/^[A-Z]{1,5}$/);
      expect(SECTORS).toContain(i.sector);
    }
  });

  it("spans enough sectors for the Diversified badge", () => {
    expect(new Set(UNIVERSE.map((i) => i.sector)).size).toBeGreaterThanOrEqual(8);
  });

  it("looks up symbols case-insensitively", () => {
    expect(getInstrument("nvda")?.name).toBe("NVIDIA Corp.");
    expect(isKnownSymbol("ZZZZ")).toBe(false);
  });

  it("ranks exact ticker matches first, then names", () => {
    expect(searchUniverse("ma")[0]!.symbol).toBe("MA");
    expect(searchUniverse("apple")[0]!.symbol).toBe("AAPL");
    expect(searchUniverse("coca")[0]!.symbol).toBe("KO");
    expect(searchUniverse("xyzzy")).toEqual([]);
  });
});
