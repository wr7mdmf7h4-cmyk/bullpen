import { describe, expect, it } from "vitest";
import { buildUniverse, cleanSecurityName, isStockLike, parseNasdaqListed, parseOtherListed } from "./symbol-directory";

const NASDAQ = `Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N
QQQ|Invesco QQQ Trust, Series 1|G|N|N|100|Y|N
ABCDW|ABCD Acquisition Corp - Warrant|S|N|N|100|N|N
ABCDU|ABCD Acquisition Corp - Units, each consisting of one share and one-half warrant|S|N|N|100|N|N
ZXYZ.A|Nasdaq Symbology Test Common Stock|Q|Y|N|100|N|N
TSMX|Some Corp - American Depositary Shares, each representing five ordinary shares|Q|N|N|100|N|N
File Creation Time: 0930202608:46|||||||`;

const OTHER = `ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
BRK.B|Berkshire Hathaway Inc. New Common Stock|N|BRK.B|N|100|N|BRK.B
EPD|Enterprise Products Partners L.P. Common Units representing Limited Partnership Interests|N|EPD|N|100|N|EPD
ABR$D|Arbor Realty Trust 6.375% Series D Cumulative Redeemable Preferred Stock|N|ABRpD|N|100|N|ABR-D
AAC.U|Ares Acquisition Corporation III Units, each consisting of one Class A ordinary share|N|AAC.U|N|100|N|AAC=
SPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY
PFF|iShares Preferred and Income Securities ETF|P|PFF|Y|100|N|PFF
XYZN|XYZ Corp 5.25% Senior Notes due 2031|N|XYZN|N|100|N|XYZN
AAPL|Apple duplicate should be ignored|N|AAPL|N|100|N|AAPL
File Creation Time: 0930202608:46||||||`;

describe("symbol directory", () => {
  it("parses both file formats and skips the trailer and test issues", () => {
    const nasdaq = parseNasdaqListed(NASDAQ);
    expect(nasdaq.map((e) => e.symbol)).not.toContain("ZXYZ.A");
    expect(nasdaq.find((e) => e.symbol === "QQQ")).toMatchObject({ exchange: "NASDAQ", isEtf: true });
    const other = parseOtherListed(OTHER);
    expect(other.find((e) => e.symbol === "SPY")).toMatchObject({ exchange: "NYSE Arca", isEtf: true });
    expect(other.find((e) => e.symbol === "BRK.B")?.exchange).toBe("NYSE");
  });

  it("keeps stocks, ADRs, share classes, MLP units and ETFs", () => {
    const symbols = buildUniverse(NASDAQ, OTHER).map((e) => e.symbol);
    expect(symbols).toEqual(["AAPL", "BRK.B", "EPD", "PFF", "QQQ", "SPY", "TSMX"]);
  });

  it("drops warrants, SPAC units, preferreds and notes", () => {
    const symbols = buildUniverse(NASDAQ, OTHER).map((e) => e.symbol);
    for (const s of ["ABCDW", "ABCDU", "ABR$D", "AAC.U", "XYZN"]) expect(symbols).not.toContain(s);
  });

  it("keeps the first listing when a symbol appears twice", () => {
    expect(buildUniverse(NASDAQ, OTHER).find((e) => e.symbol === "AAPL")?.name).toBe("Apple Inc.");
  });

  it("classifies by name", () => {
    expect(isStockLike({ name: "Foo Corp Warrants", isEtf: false })).toBe(false);
    expect(isStockLike({ name: "iShares Preferred and Income Securities ETF", isEtf: true })).toBe(true);
    expect(isStockLike({ name: "Enterprise Products Partners L.P. Common Units", isEtf: false })).toBe(true);
  });

  it.each([
    ["Zymeworks Inc. - Common Stock", "Zymeworks Inc."],
    ["Alcoa Corporation Common Stock ", "Alcoa Corporation"],
    ["Brown Forman Inc Class B Common Stock", "Brown Forman Inc"],
    [
      "ATA Creativity Global - American Depositary Shares, each representing two common shares",
      "ATA Creativity Global",
    ],
    [
      "Enterprise Products Partners L.P. Common Units representing Limited Partnership Interests",
      "Enterprise Products Partners L.P.",
    ],
    ["SPDR S&P 500 ETF Trust", "SPDR S&P 500 ETF Trust"],
  ])("cleans %j", (raw, clean) => {
    expect(cleanSecurityName(raw)).toBe(clean);
  });
});
