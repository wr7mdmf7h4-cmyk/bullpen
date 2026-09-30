/**
 * Parses the NASDAQ Trader symbol directory, the public list of every
 * security listed on NASDAQ, NYSE, NYSE American, NYSE Arca, Cboe and IEX:
 *
 *   https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt
 *   https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt
 *
 * and keeps what a retail investor would buy as "a stock": common shares,
 * ADRs, share classes (BRK.B), MLP units, REITs, closed-end funds and ETFs.
 * Warrants, rights, SPAC units, preferreds, notes and test issues are dropped.
 */

export type DirectoryEntry = {
  symbol: string;
  name: string;
  exchange: string;
  isEtf: boolean;
};

const OTHER_EXCHANGES: Record<string, string> = {
  A: "NYSE American",
  N: "NYSE",
  P: "NYSE Arca",
  Z: "Cboe BZX",
  V: "IEX",
  M: "NYSE Chicago",
};

/** Common stock or a share class like BRK.B, but not units (.U), warrants (.W) or rights (.R). */
const SYMBOL_RE = /^[A-Z]{1,5}(\.[A-QSTVXYZ])?$/;

const NOT_A_STOCK: RegExp[] = [
  /\bwarrants?\b/i,
  /\brights?\b(?!.*\betf\b)/i,
  /\bunits?\b.*\b(each|consisting)\b/i,
  /\bpreferred\b/i,
  /\bpfd\b/i,
  /\b(senior |subordinated )?notes?\b(?! etf)/i,
  /\bdebentures?\b/i,
  /\bbonds? due\b/i,
  /\bnextshares\b/i,
];

export function isStockLike(entry: { name: string; isEtf: boolean }): boolean {
  if (entry.isEtf) return !/\bwarrants?\b/i.test(entry.name);
  return !NOT_A_STOCK.some((re) => re.test(entry.name));
}

const NAME_SUFFIXES = [
  /,?\s+(Class [A-Z]\s+)?(Common Stock|Ordinary Shares?|Common Shares?|Capital Stock)(\s*\(.*\))?$/i,
  /,?\s+(American Depositary Shares?|ADS|ADSs)\b.*$/i,
  /,?\s+Shares of Beneficial Interest.*$/i,
  /,?\s+Common Units.*$/i,
  /,?\s+Units representing.*$/i,
];

/** "Zymeworks Inc. - Common Stock" → "Zymeworks Inc." */
export function cleanSecurityName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  const dash = name.indexOf(" - ");
  if (dash > 0) name = name.slice(0, dash);
  for (const re of NAME_SUFFIXES) name = name.replace(re, "");
  return name.trim().replace(/[,\s]+$/, "") || raw.trim();
}

function rows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .slice(1) // header
    .filter((line) => line && !line.startsWith("File Creation Time"))
    .map((line) => line.split("|"));
}

/** Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares */
export function parseNasdaqListed(text: string): DirectoryEntry[] {
  return rows(text).flatMap(([symbol, name, , testIssue, , , etf]) => {
    if (!symbol || !name || testIssue === "Y") return [];
    return [{ symbol: symbol.trim(), name: name.trim(), exchange: "NASDAQ", isEtf: etf === "Y" }];
  });
}

/** ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol */
export function parseOtherListed(text: string): DirectoryEntry[] {
  return rows(text).flatMap(([symbol, name, exchange, , etf, , testIssue]) => {
    if (!symbol || !name || testIssue === "Y") return [];
    return [
      {
        symbol: symbol.trim(),
        name: name.trim(),
        exchange: OTHER_EXCHANGES[exchange ?? ""] ?? "Other",
        isEtf: etf === "Y",
      },
    ];
  });
}

/** Merges both files into the tradable universe, de-duplicated by symbol. */
export function buildUniverse(nasdaqListed: string, otherListed: string): DirectoryEntry[] {
  const out = new Map<string, DirectoryEntry>();
  for (const e of [...parseNasdaqListed(nasdaqListed), ...parseOtherListed(otherListed)]) {
    if (!SYMBOL_RE.test(e.symbol) || !isStockLike(e) || out.has(e.symbol)) continue;
    out.set(e.symbol, { ...e, name: cleanSecurityName(e.name) });
  }
  return [...out.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}
