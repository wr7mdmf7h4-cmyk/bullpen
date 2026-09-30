import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getActivity, getLeaderboard } from "@/server/leaderboard";

/** Leaderboard + activity feed for a league. Members only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/leagues/[id]/live">) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const member = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId: id } },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [leaderboard, activity] = await Promise.all([getLeaderboard(id), getActivity(id)]);
  return NextResponse.json({ leaderboard, activity }, { headers: { "Cache-Control": "private, no-store" } });
}
