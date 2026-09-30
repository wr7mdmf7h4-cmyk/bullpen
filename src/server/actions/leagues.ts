"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { ACTIVE_LEAGUE_COOKIE } from "../leagues/active";
import { requireUser } from "../users";
import type { ActionResult } from "@/lib/validators";

export async function setActiveLeagueAction(leagueId: string): Promise<ActionResult> {
  const user = await requireUser();
  const id = z.string().min(1).max(40).parse(leagueId);
  const member = await db.portfolio.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: id } },
    select: { id: true },
  });
  if (!member) return { ok: false, error: "You're not in that league" };
  (await cookies()).set(ACTIVE_LEAGUE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
