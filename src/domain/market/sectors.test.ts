import { describe, expect, it } from "vitest";
import { sectorFromIndustry } from "./sectors";

describe("sectorFromIndustry", () => {
  it.each([
    ["Semiconductors", "Technology"],
    ["Technology", "Technology"],
    ["Media", "Communication Services"],
    ["Pharmaceuticals", "Health Care"],
    ["Biotechnology", "Health Care"],
    ["Banking", "Financials"],
    ["Insurance", "Financials"],
    ["Real Estate", "Real Estate"],
    ["Oil & Gas", "Energy"],
    ["Utilities", "Utilities"],
    ["Metals & Mining", "Materials"],
    ["Beverages", "Consumer Staples"],
    ["Retail", "Consumer Discretionary"],
    ["Automobiles", "Consumer Discretionary"],
    ["Aerospace & Defense", "Industrials"],
    ["Airlines", "Industrials"],
  ])("%s → %s", (industry, sector) => {
    expect(sectorFromIndustry(industry)).toBe(sector);
  });

  it("falls back to Unknown", () => {
    expect(sectorFromIndustry(null)).toBe("Unknown");
    expect(sectorFromIndustry("")).toBe("Unknown");
    expect(sectorFromIndustry("N/A")).toBe("Unknown");
  });
});
