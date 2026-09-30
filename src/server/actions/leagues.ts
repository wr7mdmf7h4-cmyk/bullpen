"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { evaluateAchievements } from "../achievements";
import { invalidateLeaderboard } from "../leaderboard";
import { ACTIVE_LEAGUE_COOKIE } from "../leagues/active";
import { LeagueFullError } from "../leagues/membership";
import { createLeague, joinByInvite, JoinError } from "../leagues/service";
import { rateLimit } from "../rate-limit";
import { requireUser } from "../users";
import { createLeagueSchema, inviteCodeSchema, type ActionResult } from "@/lib/validators";

async function setActiveLeagueCookie(leagueId: string) {
  (await cookies()).set(ACTIVE_LEAGUE_COOKIE, leagueId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setActiveLeagueAction(leagueId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = z.string().min(1).max(40).parse(leagueId);
  const member = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: id } },
    select: { id: true },
  });
  if (!member) return { ok: false, error: "You're not in that league" };
  await setActiveLeagueCookie(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createLeagueAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const limit = await rateLimit("leagueWrite", user.id);
  if (!limit.ok) return { ok: false, error: `Too many leagues too fast. Try again in ${limit.retryAfterSeconds}s.` };

  const parsed = createLeagueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { startingCashDollars, ...rest } = parsed.data;
  const league = await createLeague(user.id, { ...rest, startingCashCents: startingCashDollars * 100 });
  await evaluateAchievements(user.id).catch(() => []);
  await setActiveLeagueCookie(league.id);
  redirect(`/leagues/${league.id}?created=1`);
}

export async function joinLeagueAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const limit = await rateLimit("leagueWrite", user.id);
  if (!limit.ok) return { ok: false, error: `Slow down. Try again in ${limit.retryAfterSeconds}s.` };

  const code = inviteCodeSchema.safeParse(formData.get("code"));
  if (!code.success) {
    return { ok: false, error: "Invite codes are 8 letters and numbers.", fieldErrors: { code: ["Invalid code"] } };
  }

  let leagueId: string;
  try {
    const { league } = await joinByInvite(user.id, code.data);
    leagueId = league.id;
  } catch (err) {
    if (err instanceof JoinError || err instanceof LeagueFullError) return { ok: false, error: err.message };
    throw err;
  }
  invalidateLeaderboard(leagueId);
  await setActiveLeagueCookie(leagueId);
  redirect(`/leagues/${leagueId}?joined=1`);
}
