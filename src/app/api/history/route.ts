import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getHistory } from "@/server/market";
import { isKnownSymbol } from "@/domain/market/universe";
import { CHART_RANGES } from "@/domain/market/types";

const querySchema = z.object({
  source: z.enum(["LIVE", "SIMULATED"]),
  symbol: z.string().toUpperCase().refine(isKnownSymbol, "Unknown symbol"),
  range: z.enum(CHART_RANGES),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { symbol, source, range } = parsed.data;
  const history = await getHistory(symbol, source, range);
  return NextResponse.json(history, { headers: { "Cache-Control": "private, max-age=5" } });
}
