"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { requireAdmin } from "../admin";
import { invalidateLeaderboard } from "../leaderboard";
import { AdminError, deleteLeagueAsAdmin, deletePlayer } from "../moderation";
import { notifyLeague } from "../realtime";
import type { ActionResult } from "@/lib/validators";

const idSchema = z.string().min(1).max(40);

/** What the admin must type to confirm removing a player. */
function confirmationFor(user: { username: string | null; email: string }) {
  return user.username ?? user.email;
}

export async function removePlayerAction(userId: string, typedConfirmation: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.parse(userId);
  const target = await db.user.findUnique({ where: { id }, select: { username: true, email: true } });
  if (!target) return { ok: false, error: "That player has already been removed." };
  if (typedConfirmation.trim() !== confirmationFor(target)) {
    return { ok: false, error: `Type ${confirmationFor(target)} to confirm.` };
  }

  try {
    const { keptLeagues } = await deletePlayer(id, admin.id);
    for (const leagueId of keptLeagues) {
      invalidateLeaderboard(leagueId);
      await notifyLeague(leagueId, "leaderboard");
    }
  } catch (err) {
    if (err instanceof AdminError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteLeagueAction(leagueId: string): Promise<ActionResult> {
  await requireAdmin();
  const id = idSchema.parse(leagueId);
  try {
    await deleteLeagueAsAdmin(id);
  } catch (err) {
    if (err instanceof AdminError) return { ok: false, error: err.message };
    throw err;
  }
  invalidateLeaderboard(id);
  revalidatePath("/admin");
  return { ok: true };
}
