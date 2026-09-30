import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getQuotes, UnknownSymbolError } from "@/server/market";
import { tickerSchema } from "@/lib/validators";
import { serializeQuote } from "@/lib/serialize";

const querySchema = z.object({
  source: z.enum(["LIVE", "SIMULATED"]),
  symbols: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(tickerSchema).min(1).max(60)),
});

/** Polled by price tickers. Auth-only so anonymous traffic can't burn the API quota. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  try {
    const quotes = await getQuotes(parsed.data.symbols, parsed.data.source);
    return NextResponse.json(
      { quotes: [...quotes.values()].map(serializeQuote) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (err instanceof UnknownSymbolError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
