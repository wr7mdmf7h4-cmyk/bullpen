import "server-only";
import { db } from "./db";
import { env } from "./env";
import { ensureReferenceData } from "./reference-data";
import { fetchProfile } from "./market/finnhub";
import { rankSearch, simulationProfile, UNKNOWN_SECTOR, type InstrumentDef } from "@/domain/market/universe";
import { sectorFromIndustry } from "@/domain/market/sectors";

/**
 * The full instrument universe (~12k rows), loaded from Postgres once per
 * server instance and refreshed every 10 minutes. Small enough to keep in
 * memory, which makes symbol lookups and search effectively free.
 */
export type Instrument = InstrumentDef & { isEtf: boolean; isPopular: boolean; isActive: boolean };

const REFRESH_MS = 10 * 60_000;
let cache: { at: number; bySymbol: Map<string, Instrument> } | undefined;
let loading: Promise<Map<string, Instrument>> | undefined;

async function load(): Promise<Map<string, Instrument>> {
  await ensureReferenceData();
  const rows = await db.instrument.findMany({
    select: {
      symbol: true,
      name: true,
      sector: true,
      exchange: true,
      isEtf: true,
      isPopular: true,
      isActive: true,
      basePriceCents: true,
      volBps: true,
    },
  });
  const bySymbol = new Map<string, Instrument>();
  for (const r of rows) {
    const profile = simulationProfile(r.symbol, r.isEtf);
    bySymbol.set(r.symbol, {
      symbol: r.symbol,
      name: r.name,
      sector: r.sector,
      exchange: r.exchange,
      isEtf: r.isEtf,
      isPopular: r.isPopular,
      isActive: r.isActive,
      basePrice: r.basePriceCents !== null ? r.basePriceCents / 100 : profile.basePrice,
      vol: r.volBps !== null ? r.volBps / 10_000 : profile.vol,
    });
  }
  cache = { at: Date.now(), bySymbol };
  return bySymbol;
}

async function universe(): Promise<Map<string, Instrument>> {
  if (cache && Date.now() - cache.at < REFRESH_MS) return cache.bySymbol;
  loading ??= load().finally(() => (loading = undefined));
  return cache?.bySymbol ?? loading; // serve stale while refreshing
}

export function invalidateInstruments() {
  cache = undefined;
}

export async function findInstrument(symbol: string): Promise<Instrument | undefined> {
  return (await universe()).get(symbol.toUpperCase());
}

export async function findInstruments(symbols: string[]): Promise<Map<string, Instrument>> {
  const all = await universe();
  const out = new Map<string, Instrument>();
  for (const s of symbols) {
    const hit = all.get(s.toUpperCase());
    if (hit) out.set(hit.symbol, hit);
  }
  return out;
}

export async function popularInstruments(): Promise<Instrument[]> {
  return [...(await universe()).values()].filter((i) => i.isPopular && i.isActive);
}

export async function countInstruments(): Promise<number> {
  let n = 0;
  for (const i of (await universe()).values()) if (i.isActive) n++;
  return n;
}

export async function searchInstruments(query: string, limit = 12): Promise<Instrument[]> {
  const active = [...(await universe()).values()].filter((i) => i.isActive);
  return rankSearch(active, query, limit);
}

/**
 * Stocks outside the hand-picked list start with sector "Unknown". When a
 * Finnhub key is configured we classify them the first time someone opens
 * the stock page (one /stock/profile2 call, stored forever).
 */
export async function enrichSector(instrument: Instrument): Promise<Instrument> {
  const key = env().FINNHUB_API_KEY;
  if (!key || instrument.isEtf || instrument.sector !== UNKNOWN_SECTOR) return instrument;
  try {
    const profile = await fetchProfile(instrument.symbol, key);
    const sector = sectorFromIndustry(profile.industry);
    if (sector === UNKNOWN_SECTOR) return instrument;
    await db.instrument.update({ where: { symbol: instrument.symbol }, data: { sector } });
    instrument.sector = sector; // update the cached object in place
    return instrument;
  } catch (err) {
    console.warn(`[instruments] profile ${instrument.symbol}: ${String(err)}`);
    return instrument;
  }
}
