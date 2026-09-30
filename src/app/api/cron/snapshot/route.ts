import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { invalidateInstruments } from "@/server/instruments";
import { snapshotAllPortfolios } from "@/server/portfolio";
import { lastSyncedAt, syncInstruments } from "@/lib/instrument-sync";

const WEEK_MS = 7 * 86_400_000;

// Valuing every portfolio can take a few seconds on a cold start.
export const maxDuration = 60;

/**
 * Daily job (Vercel Cron → vercel.json): snapshot every portfolio, and
 * re-sync the instrument universe (new listings / delistings) once a week. Vercel sends
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
  const snapshots = await snapshotAllPortfolios();

  let instruments: { symbols: number; delisted: number } | { skipped: true } | { error: string } = { skipped: true };
  const synced = await lastSyncedAt(db);
  if (!synced || Date.now() - synced.getTime() > WEEK_MS) {
    try {
      instruments = await syncInstruments(db);
      invalidateInstruments();
    } catch (err) {
      instruments = { error: String(err) }; // snapshots still succeeded
    }
  }
  return NextResponse.json({ snapshots, instruments, ms: Date.now() - started });
}
