import { describe, expect, it } from "vitest";
import { getInstrument, UNIVERSE } from "./universe";
import { effectiveTime, simulatedHistory, simulatedPriceCents, simulatedQuote, TICK_MS } from "./simulated";

const nvda = getInstrument("NVDA")!;
const t0 = Date.UTC(2026, 5, 15, 15, 0, 0);

describe("simulated market", () => {
  it("is deterministic: same symbol and time → same price", () => {
    expect(simulatedPriceCents(nvda, t0)).toBe(simulatedPriceCents(nvda, t0));
  });

  it("holds the price constant within a 5s tick", () => {
    const tick = Math.floor(t0 / TICK_MS) * TICK_MS;
    expect(simulatedPriceCents(nvda, tick)).toBe(simulatedPriceCents(nvda, tick + TICK_MS - 1));
  });

  it("moves between ticks and differs between symbols", () => {
    const prices = new Set(Array.from({ length: 20 }, (_, i) => simulatedPriceCents(nvda, t0 + i * 60_000)));
    expect(prices.size).toBeGreaterThan(10);
    expect(simulatedPriceCents(getInstrument("AAPL")!, t0)).not.toBe(simulatedPriceCents(nvda, t0));
  });

  it("produces positive integer cents that stay in a plausible band", () => {
    for (const def of UNIVERSE) {
      for (let day = 0; day < 365; day += 7) {
        const p = simulatedPriceCents(def, Date.UTC(2026, 0, 1) + day * 86_400_000);
        expect(Number.isInteger(p)).toBe(true);
        expect(p).toBeGreaterThan(def.basePrice * 100 * 0.2);
        expect(p).toBeLessThan(def.basePrice * 100 * 5);
      }
    }
  });

  it("freezes LIVE-calendar prices at the last close while the market is closed", () => {
    const saturday = new Date("2026-10-03T15:00:00Z");
    const sunday = new Date("2026-10-04T15:00:00Z");
    expect(effectiveTime("NYSE", saturday)).toBe(Date.parse("2026-10-02T20:00:00Z"));
    expect(simulatedQuote(nvda, "NYSE", saturday).priceCents).toBe(simulatedQuote(nvda, "NYSE", sunday).priceCents);
  });

  it("keeps the 24/7 calendar moving on weekends", () => {
    const a = simulatedQuote(nvda, "ALWAYS", new Date("2026-10-03T15:00:00Z"));
    const b = simulatedQuote(nvda, "ALWAYS", new Date("2026-10-03T18:00:00Z"));
    expect(a.priceCents).not.toBe(b.priceCents);
  });

  it("builds a quote whose high/low bracket the price", () => {
    const q = simulatedQuote(nvda, "ALWAYS", new Date(t0));
    expect(q.highCents!).toBeGreaterThanOrEqual(q.priceCents);
    expect(q.lowCents!).toBeLessThanOrEqual(q.priceCents);
    expect(q.source).toBe("simulated");
  });

  it("returns chart history that ends at the current price", () => {
    const now = new Date("2026-09-29T17:00:00Z");
    for (const range of ["1D", "1W", "1M", "1Y"] as const) {
      for (const cal of ["ALWAYS", "NYSE"] as const) {
        const pts = simulatedHistory(nvda, cal, range, now);
        expect(pts.length).toBeGreaterThan(5);
        expect(pts.at(-1)!.p).toBe(simulatedQuote(nvda, cal, now).priceCents);
        // strictly increasing timestamps
        expect(pts.every((pt, i) => i === 0 || pt.t > pts[i - 1]!.t)).toBe(true);
      }
    }
  });
});
