import { describe, expect, it } from "vitest";
import {
  countsForDiversification,
  getPopularInstrument,
  POPULAR,
  rankSearch,
  searchPopular,
  SECTORS,
  simulationProfile,
} from "./universe";

describe("popular instruments", () => {
  it("has ~50 unique, uppercase symbols with valid sectors", () => {
    expect(POPULAR.length).toBeGreaterThanOrEqual(50);
    expect(new Set(POPULAR.map((i) => i.symbol)).size).toBe(POPULAR.length);
    for (const i of POPULAR) {
      expect(i.symbol).toMatch(/^[A-Z]{1,5}$/);
      expect(SECTORS).toContain(i.sector);
    }
  });

  it("spans enough sectors for the Diversified badge", () => {
    expect(new Set(POPULAR.map((i) => i.sector).filter(countsForDiversification)).size).toBeGreaterThanOrEqual(8);
  });

  it("looks up symbols case-insensitively", () => {
    expect(getPopularInstrument("nvda")?.name).toBe("NVIDIA Corp.");
    expect(getPopularInstrument("ZZZZ")).toBeUndefined();
  });

  it("excludes ETFs and unclassified stocks from diversification", () => {
    expect(countsForDiversification("Technology")).toBe(true);
    expect(countsForDiversification("ETF")).toBe(false);
    expect(countsForDiversification("Unknown")).toBe(false);
  });
});

describe("rankSearch", () => {
  const items = [
    { symbol: "APLE", name: "Apple Hospitality REIT" },
    { symbol: "AAPL", name: "Apple Inc.", isPopular: true },
    { symbol: "MA", name: "Mastercard Inc." },
    { symbol: "MAR", name: "Marriott International" },
    { symbol: "KO", name: "Coca-Cola Company (The)" },
    { symbol: "BRK.B", name: "Berkshire Hathaway Inc." },
  ];

  it("ranks exact ticker, then ticker prefix, then names", () => {
    expect(rankSearch(items, "ma").map((i) => i.symbol)).toEqual(["MA", "MAR"]);
    expect(rankSearch(items, "coca")[0]!.symbol).toBe("KO");
    expect(rankSearch(items, "brk")[0]!.symbol).toBe("BRK.B");
  });

  it("prefers popular names on ties", () => {
    expect(rankSearch(items, "apple")[0]!.symbol).toBe("AAPL");
  });

  it("returns popular items for an empty query and nothing for gibberish", () => {
    expect(rankSearch(items, "").map((i) => i.symbol)).toEqual(["AAPL"]);
    expect(rankSearch(items, "xyzzy")).toEqual([]);
  });

  it("searches the bundled popular list", () => {
    expect(searchPopular("apple")[0]!.symbol).toBe("AAPL");
  });
});

describe("simulationProfile", () => {
  it("is deterministic per symbol", () => {
    expect(simulationProfile("ZYME", false)).toEqual(simulationProfile("zyme", false));
    expect(simulationProfile("ZYME", false)).not.toEqual(simulationProfile("ZYMX", false));
  });

  it("produces plausible prices and volatilities", () => {
    for (const sym of ["A", "ZYME", "BRK.B", "SQQQ", "TSM", "HOOD", "QQQM", "XYZ"]) {
      const stock = simulationProfile(sym, false);
      expect(stock.basePrice).toBeGreaterThanOrEqual(8);
      expect(stock.basePrice).toBeLessThanOrEqual(400);
      expect(stock.vol).toBeGreaterThanOrEqual(0.25);
      expect(stock.vol).toBeLessThanOrEqual(0.8);
      const etf = simulationProfile(sym, true);
      expect(etf.vol).toBeLessThan(0.33);
    }
  });
});
