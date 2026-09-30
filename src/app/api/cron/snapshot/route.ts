import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { snapshotAllPortfolios } from "@/server/portfolio";

// Valuing every portfolio can take a few seconds on a cold start.
export const maxDuration = 60;

/**
 * Daily portfolio snapshot (Vercel Cron → vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET the endpoint only
 * works in development; trades still snapshot on their own.
 */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const started = Date.now();
  const result = await snapshotAllPortfolios();
  return NextResponse.json({ ...result, ms: Date.now() - started });
}
