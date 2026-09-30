import { UNKNOWN_SECTOR } from "./universe";

/**
 * Maps Finnhub's `finnhubIndustry` (e.g. "Semiconductors", "Banking") onto
 * the 11 GICS-style sectors used across the app, so the "Diversified" badge
 * counts sectors consistently for every stock.
 */
const RULES: [RegExp, string][] = [
  // order matters: "Biotechnology" must hit Health Care before /technology/
  [/pharma|biotech|health|medical|life sciences|drug/i, "Health Care"],
  [
    /semiconductor|technology|software|internet|electronic|computer|it services|communications equipment/i,
    "Technology",
  ],
  [/media|telecom|entertainment|communication|advertising|publishing|gaming|social/i, "Communication Services"],
  [/bank|insurance|financial|capital markets|asset management|credit|brokerage|thrift/i, "Financials"],
  [/real estate|reit/i, "Real Estate"],
  [/oil|gas|energy|coal|petroleum/i, "Energy"],
  [/utilit|electric power|water/i, "Utilities"],
  [/chemical|metals|mining|steel|paper|forest|packaging|construction materials|gold/i, "Materials"],
  [/food|beverage|tobacco|household|personal products|consumer staples|grocery/i, "Consumer Staples"],
  [
    /retail|automobile|auto|hotel|restaurant|leisure|textile|apparel|luxury|consumer products|education|homebuild|distribut/i,
    "Consumer Discretionary",
  ],
  [
    /aerospace|defense|airline|machinery|industrial|transport|logistics|construction|engineering|building|trading companies|commercial services|professional services|marine|road|rail/i,
    "Industrials",
  ],
];

export function sectorFromIndustry(industry: string | null | undefined): string {
  if (!industry) return UNKNOWN_SECTOR;
  return RULES.find(([re]) => re.test(industry))?.[1] ?? UNKNOWN_SECTOR;
}
