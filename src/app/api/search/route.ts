import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { searchInstruments } from "@/server/instruments";

const querySchema = z.object({
  q: z.string().trim().max(60).default(""),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export type SearchResult = { symbol: string; name: string; exchange: string; sector: string; isEtf: boolean };

/** Search across every US-listed stock and ETF (in-memory, ~12k symbols). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const results: SearchResult[] = (await searchInstruments(parsed.data.q, parsed.data.limit)).map((i) => ({
    symbol: i.symbol,
    name: i.name,
    exchange: i.exchange,
    sector: i.sector,
    isEtf: i.isEtf,
  }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=60" } });
}
