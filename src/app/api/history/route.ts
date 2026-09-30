import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getHistory, getQuotes, UnknownSymbolError } from "@/server/market";
import { CHART_RANGES } from "@/domain/market/types";
import { tickerSchema } from "@/lib/validators";

const querySchema = z.object({
  symbol: tickerSchema,
  range: z.enum(CHART_RANGES),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { symbol, range } = parsed.data;
  try {
    // Cached quote only (no extra API call) to end the line at the latest price.
    const current = (await getQuotes([symbol], { maxFetch: 0 })).get(symbol);
    const history = await getHistory(symbol, range, new Date(), current);
    return NextResponse.json(history, { headers: { "Cache-Control": "private, max-age=5" } });
  } catch (err) {
    if (err instanceof UnknownSymbolError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
