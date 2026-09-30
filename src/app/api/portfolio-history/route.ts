import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getPortfolioHistory } from "@/server/portfolio";
import { CHART_RANGES } from "@/domain/market/types";

const querySchema = z.object({
  portfolioId: z.string().min(1).max(40),
  range: z.enum(CHART_RANGES),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  // Only the owner can read a portfolio's value history.
  const owned = await db.portfolio.findFirst({
    where: { id: parsed.data.portfolioId, userId: session.user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const points = await getPortfolioHistory(owned.id, parsed.data.range);
  return NextResponse.json({ points }, { headers: { "Cache-Control": "private, no-store" } });
}
