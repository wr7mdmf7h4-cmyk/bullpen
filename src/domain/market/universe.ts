/**
 * Instruments.
 *
 * The full tradable universe (~12k US-listed stocks and ETFs) lives in the
 * database, synced from the exchange symbol directory. This module holds the
 * pure pieces: the hand-picked POPULAR list (shown on the Markets page, used
 * by the seed and the landing-page ticker, with tuned simulation parameters),
 * a deterministic simulation profile for every other ticker, and search.
 *
 * `basePrice` (dollars) and `vol` (annualised volatility) only drive the
 * simulated market; live leagues use real quotes.
 */

export const SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Health Care",
  "Energy",
  "Industrials",
  "Utilities",
  "Real Estate",
  "Materials",
  "ETF",
] as const;

export type Sector = (typeof SECTORS)[number];

/** Sector for instruments we haven't classified yet. */
export const UNKNOWN_SECTOR = "Unknown";

/** Whether a sector counts towards the "Diversified" badge. */
export function countsForDiversification(sector: string): boolean {
  return sector !== "ETF" && sector !== UNKNOWN_SECTOR;
}

export type InstrumentDef = {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  basePrice: number;
  vol: number;
  isEtf?: boolean;
};

export const POPULAR: readonly InstrumentDef[] = [
  // Technology
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 232, vol: 0.28 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 485, vol: 0.25 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 178, vol: 0.5 },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology", exchange: "NASDAQ", basePrice: 165, vol: 0.5 },
  { symbol: "INTC", name: "Intel Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 26, vol: 0.45 },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 305, vol: 0.42 },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology", exchange: "NYSE", basePrice: 235, vol: 0.38 },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology", exchange: "NYSE", basePrice: 255, vol: 0.33 },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 375, vol: 0.33 },
  { symbol: "CSCO", name: "Cisco Systems", sector: "Technology", exchange: "NASDAQ", basePrice: 68, vol: 0.22 },
  {
    symbol: "PLTR",
    name: "Palantir Technologies",
    sector: "Technology",
    exchange: "NASDAQ",
    basePrice: 155,
    vol: 0.65,
  },
  { symbol: "SHOP", name: "Shopify Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 150, vol: 0.55 },
  // Communication Services
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 205,
    vol: 0.3,
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 720,
    vol: 0.38,
  },
  {
    symbol: "NFLX",
    name: "Netflix Inc.",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 118,
    vol: 0.38,
  },
  {
    symbol: "DIS",
    name: "Walt Disney Co.",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 115,
    vol: 0.27,
  },
  {
    symbol: "SPOT",
    name: "Spotify Technology",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 640,
    vol: 0.45,
  },
  {
    symbol: "RBLX",
    name: "Roblox Corp.",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 120,
    vol: 0.55,
  },
  // Consumer Discretionary
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 225,
    vol: 0.32,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 340,
    vol: 0.65,
  },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary", exchange: "NYSE", basePrice: 72, vol: 0.33 },
  {
    symbol: "MCD",
    name: "McDonald's Corp.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 305,
    vol: 0.18,
  },
  {
    symbol: "SBUX",
    name: "Starbucks Corp.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 88,
    vol: 0.3,
  },
  {
    symbol: "HD",
    name: "Home Depot Inc.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 385,
    vol: 0.22,
  },
  {
    symbol: "GME",
    name: "GameStop Corp.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 25,
    vol: 0.9,
  },
  // Consumer Staples
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples", exchange: "NYSE", basePrice: 70, vol: 0.15 },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", exchange: "NASDAQ", basePrice: 145, vol: 0.17 },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples", exchange: "NYSE", basePrice: 100, vol: 0.2 },
  {
    symbol: "COST",
    name: "Costco Wholesale",
    sector: "Consumer Staples",
    exchange: "NASDAQ",
    basePrice: 945,
    vol: 0.2,
  },
  { symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", exchange: "NYSE", basePrice: 155, vol: 0.15 },
  // Financials
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", exchange: "NYSE", basePrice: 295, vol: 0.22 },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", exchange: "NYSE", basePrice: 48, vol: 0.25 },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials", exchange: "NYSE", basePrice: 710, vol: 0.28 },
  { symbol: "V", name: "Visa Inc.", sector: "Financials", exchange: "NYSE", basePrice: 345, vol: 0.18 },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials", exchange: "NYSE", basePrice: 570, vol: 0.2 },
  { symbol: "PYPL", name: "PayPal Holdings", sector: "Financials", exchange: "NASDAQ", basePrice: 70, vol: 0.35 },
  { symbol: "COIN", name: "Coinbase Global", sector: "Financials", exchange: "NASDAQ", basePrice: 320, vol: 0.75 },
  // Health Care
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Health Care", exchange: "NYSE", basePrice: 790, vol: 0.3 },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health Care", exchange: "NYSE", basePrice: 172, vol: 0.15 },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Health Care", exchange: "NYSE", basePrice: 305, vol: 0.35 },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Health Care", exchange: "NYSE", basePrice: 25, vol: 0.22 },
  { symbol: "MRNA", name: "Moderna Inc.", sector: "Health Care", exchange: "NASDAQ", basePrice: 28, vol: 0.7 },
  // Energy
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", exchange: "NYSE", basePrice: 112, vol: 0.22 },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy", exchange: "NYSE", basePrice: 155, vol: 0.23 },
  // Industrials
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials", exchange: "NYSE", basePrice: 220, vol: 0.38 },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials", exchange: "NYSE", basePrice: 410, vol: 0.28 },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials", exchange: "NYSE", basePrice: 255, vol: 0.3 },
  { symbol: "UBER", name: "Uber Technologies", sector: "Industrials", exchange: "NYSE", basePrice: 92, vol: 0.4 },
  // Utilities, Real Estate, Materials
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", exchange: "NYSE", basePrice: 74, vol: 0.22 },
  { symbol: "AMT", name: "American Tower Corp.", sector: "Real Estate", exchange: "NYSE", basePrice: 210, vol: 0.25 },
  { symbol: "LIN", name: "Linde plc", sector: "Materials", exchange: "NASDAQ", basePrice: 465, vol: 0.18 },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Materials", exchange: "NYSE", basePrice: 42, vol: 0.42 },
  // ETFs
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF", exchange: "NYSE ARCA", basePrice: 645, vol: 0.16 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", exchange: "NASDAQ", basePrice: 575, vol: 0.2 },
];

const BY_SYMBOL = new Map(POPULAR.map((i) => [i.symbol, i]));

/** One of the hand-picked popular instruments (the full universe is in the DB). */
export function getPopularInstrument(symbol: string): InstrumentDef | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

/** 32-bit string hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic simulation parameters for any ticker: a log-uniform base
 * price ($8–$400 for stocks, $15–$500 for ETFs) and a volatility typical for
 * the asset type. Same symbol → same numbers on every server.
 */
export function simulationProfile(symbol: string, isEtf: boolean): { basePrice: number; vol: number } {
  const h = hash(symbol.toUpperCase());
  const u1 = (h % 10_007) / 10_007;
  const u2 = ((h >>> 12) % 10_009) / 10_009;
  const [lo, hi] = isEtf ? [15, 500] : [8, 400];
  const basePrice = Math.round(Math.exp(Math.log(lo) + u1 * (Math.log(hi) - Math.log(lo))) * 100) / 100;
  const vol = isEtf ? 0.12 + u2 * 0.2 : 0.25 + u2 * 0.55;
  return { basePrice, vol: Math.round(vol * 1000) / 1000 };
}

export type Searchable = { symbol: string; name: string; isPopular?: boolean };

/**
 * Case-insensitive ranking over ticker and company name: exact ticker, then
 * ticker prefix, then name prefix/word prefix, then substring. Popular names
 * win ties so "apple" finds AAPL before APLE.
 */
export function rankSearch<T extends Searchable>(items: Iterable<T>, query: string, limit = 10): T[] {
  const q = query.trim().toLowerCase();
  const all = [...items];
  if (!q) return all.filter((i) => i.isPopular).slice(0, limit);
  const scored: { item: T; score: number }[] = [];
  for (const item of all) {
    const sym = item.symbol.toLowerCase();
    const name = item.name.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 10 + sym.length;
    else if (name.startsWith(q)) score = 30;
    else if (name.split(/[\s.,&()-]+/).some((w) => w.startsWith(q))) score = 40;
    else if (name.includes(q)) score = 50;
    if (score < 0) continue;
    if (item.isPopular) score -= 5;
    scored.push({ item, score });
  }
  return scored
    .sort(
      (a, b) =>
        a.score - b.score || a.item.symbol.length - b.item.symbol.length || a.item.symbol.localeCompare(b.item.symbol),
    )
    .slice(0, limit)
    .map((s) => s.item);
}

/** Search within the popular list (used where the database isn't needed). */
export function searchPopular(query: string, limit = 10): InstrumentDef[] {
  return rankSearch(
    POPULAR.map((i) => ({ ...i, isPopular: true })),
    query,
    limit,
  );
}
