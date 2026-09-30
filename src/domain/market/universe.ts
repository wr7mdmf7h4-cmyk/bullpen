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
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 295.66, vol: 0.28 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 431.38, vol: 0.25 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 192.23, vol: 0.5 },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    sector: "Technology",
    exchange: "NASDAQ",
    basePrice: 578.9,
    vol: 0.5,
  },
  { symbol: "INTC", name: "Intel Corp.", sector: "Technology", exchange: "NASDAQ", basePrice: 70.41, vol: 0.45 },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 399.91, vol: 0.42 },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology", exchange: "NYSE", basePrice: 110.49, vol: 0.38 },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology", exchange: "NYSE", basePrice: 193.71, vol: 0.33 },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 230.11, vol: 0.33 },
  { symbol: "CSCO", name: "Cisco Systems", sector: "Technology", exchange: "NASDAQ", basePrice: 128.53, vol: 0.22 },
  {
    symbol: "PLTR",
    name: "Palantir Technologies",
    sector: "Technology",
    exchange: "NASDAQ",
    basePrice: 312.53,
    vol: 0.65,
  },
  { symbol: "SHOP", name: "Shopify Inc.", sector: "Technology", exchange: "NASDAQ", basePrice: 104.54, vol: 0.55 },
  // Communication Services
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 247.23,
    vol: 0.3,
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 1088.48,
    vol: 0.38,
  },
  {
    symbol: "NFLX",
    name: "Netflix Inc.",
    sector: "Communication Services",
    exchange: "NASDAQ",
    basePrice: 83.27,
    vol: 0.38,
  },
  {
    symbol: "DIS",
    name: "Walt Disney Co.",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 80.73,
    vol: 0.27,
  },
  {
    symbol: "SPOT",
    name: "Spotify Technology",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 317.46,
    vol: 0.45,
  },
  {
    symbol: "RBLX",
    name: "Roblox Corp.",
    sector: "Communication Services",
    exchange: "NYSE",
    basePrice: 55.55,
    vol: 0.55,
  },
  // Consumer Discretionary
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 356.76,
    vol: 0.32,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 848.03,
    vol: 0.65,
  },
  { symbol: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary", exchange: "NYSE", basePrice: 47.68, vol: 0.33 },
  {
    symbol: "MCD",
    name: "McDonald's Corp.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 231.21,
    vol: 0.18,
  },
  {
    symbol: "SBUX",
    name: "Starbucks Corp.",
    sector: "Consumer Discretionary",
    exchange: "NASDAQ",
    basePrice: 95.74,
    vol: 0.3,
  },
  {
    symbol: "HD",
    name: "Home Depot Inc.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 277.84,
    vol: 0.22,
  },
  {
    symbol: "GME",
    name: "GameStop Corp.",
    sector: "Consumer Discretionary",
    exchange: "NYSE",
    basePrice: 16.75,
    vol: 0.9,
  },
  // Consumer Staples
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples", exchange: "NYSE", basePrice: 80.78, vol: 0.15 },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", exchange: "NASDAQ", basePrice: 115.33, vol: 0.17 },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples", exchange: "NYSE", basePrice: 91, vol: 0.2 },
  {
    symbol: "COST",
    name: "Costco Wholesale",
    sector: "Consumer Staples",
    exchange: "NASDAQ",
    basePrice: 945.04,
    vol: 0.2,
  },
  {
    symbol: "PG",
    name: "Procter & Gamble",
    sector: "Consumer Staples",
    exchange: "NYSE",
    basePrice: 144.69,
    vol: 0.15,
  },
  // Financials
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", exchange: "NYSE", basePrice: 348.86, vol: 0.22 },
  { symbol: "BAC", name: "Bank of America", sector: "Financials", exchange: "NYSE", basePrice: 42.62, vol: 0.25 },
  { symbol: "GS", name: "Goldman Sachs", sector: "Financials", exchange: "NYSE", basePrice: 1258.96, vol: 0.28 },
  { symbol: "V", name: "Visa Inc.", sector: "Financials", exchange: "NYSE", basePrice: 394.3, vol: 0.18 },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials", exchange: "NYSE", basePrice: 640.71, vol: 0.2 },
  { symbol: "PYPL", name: "PayPal Holdings", sector: "Financials", exchange: "NASDAQ", basePrice: 47.19, vol: 0.35 },
  { symbol: "COIN", name: "Coinbase Global", sector: "Financials", exchange: "NASDAQ", basePrice: 95.48, vol: 0.75 },
  // Health Care
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Health Care", exchange: "NYSE", basePrice: 913.83, vol: 0.3 },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Health Care", exchange: "NYSE", basePrice: 293.13, vol: 0.15 },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Health Care", exchange: "NYSE", basePrice: 367.66, vol: 0.35 },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Health Care", exchange: "NYSE", basePrice: 34.91, vol: 0.22 },
  { symbol: "MRNA", name: "Moderna Inc.", sector: "Health Care", exchange: "NASDAQ", basePrice: 203.35, vol: 0.7 },
  // Energy
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", exchange: "NYSE", basePrice: 137.46, vol: 0.22 },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy", exchange: "NYSE", basePrice: 197.87, vol: 0.23 },
  // Industrials
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials", exchange: "NYSE", basePrice: 282.01, vol: 0.38 },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials", exchange: "NYSE", basePrice: 977.79, vol: 0.28 },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials", exchange: "NYSE", basePrice: 440.7, vol: 0.3 },
  { symbol: "UBER", name: "Uber Technologies", sector: "Industrials", exchange: "NYSE", basePrice: 61.49, vol: 0.4 },
  // Utilities, Real Estate, Materials
  { symbol: "NEE", name: "NextEra Energy", sector: "Utilities", exchange: "NYSE", basePrice: 68.67, vol: 0.22 },
  {
    symbol: "AMT",
    name: "American Tower Corp.",
    sector: "Real Estate",
    exchange: "NYSE",
    basePrice: 172.11,
    vol: 0.25,
  },
  { symbol: "LIN", name: "Linde plc", sector: "Materials", exchange: "NASDAQ", basePrice: 590.65, vol: 0.18 },
  { symbol: "FCX", name: "Freeport-McMoRan", sector: "Materials", exchange: "NYSE", basePrice: 51.22, vol: 0.42 },
  // ETFs
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF", exchange: "NYSE ARCA", basePrice: 799.96, vol: 0.16 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", exchange: "NASDAQ", basePrice: 633.96, vol: 0.2 },
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

const WORD_SPLIT = /[\s.,&()'/-]+/;

/**
 * Edit distance (optimal string alignment: insert, delete, substitute,
 * swap adjacent) with an early exit once it must exceed `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Typo budget grows with word length: none for short tokens, 1 up to 7 letters, then 2. */
function typoBudget(token: string) {
  return token.length < 4 ? 0 : token.length <= 7 ? 1 : 2;
}

/** How closely a query token matches a name word: 0 = prefix, n = n typos, -1 = no match. */
function tokenMatch(token: string, word: string): number {
  if (word.startsWith(token)) return 0;
  const budget = typoBudget(token);
  if (!budget) return -1;
  // Compare against the whole word and against a same-length prefix (typing in progress).
  const d = Math.min(editDistance(token, word, budget), editDistance(token, word.slice(0, token.length), budget));
  return d <= budget ? d : -1;
}

/**
 * Case-insensitive ranking over ticker and company name: exact ticker, then
 * ticker prefix, then name prefix/word prefix, then substring, then
 * typo-tolerant word matches ("firserv" → Fiserv, "nvidea" → NVIDIA).
 * Every word of a multi-word query must match. Popular names win ties so
 * "apple" finds AAPL before APLE.
 */
export function rankSearch<T extends Searchable>(items: Iterable<T>, query: string, limit = 10): T[] {
  const q = query.trim().toLowerCase();
  const all = [...items];
  if (!q) return all.filter((i) => i.isPopular).slice(0, limit);
  const tokens = q.split(WORD_SPLIT).filter(Boolean);
  const scored: { item: T; score: number }[] = [];
  for (const item of all) {
    const sym = item.symbol.toLowerCase();
    const name = item.name.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 10 + sym.length;
    else if (name.startsWith(q)) score = 30;
    else if (name.includes(q)) score = 40;
    else {
      // Every query token must match some word of the name (typos allowed).
      const words = name.split(WORD_SPLIT).filter(Boolean);
      let typos = 0;
      for (const token of tokens) {
        let best = -1;
        for (const w of words) {
          const m = tokenMatch(token, w);
          if (m >= 0 && (best < 0 || m < best)) best = m;
          if (best === 0) break;
        }
        if (best < 0) {
          typos = -1;
          break;
        }
        typos += best;
      }
      if (typos >= 0) score = 50 + typos * 10;
    }
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
