"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { findInstrument } from "../instruments";
import { rateLimit } from "../rate-limit";
import { requireUser } from "../users";
import { avatarValue } from "@/domain/profile";
import { profileSchema, type ActionResult, type ProfileInput } from "@/lib/validators";

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult<{ username: string }>> {
  const user = await requireUser();
  const limit = await rateLimit("profile", user.id);
  if (!limit.ok) return { ok: false, error: `Slow down. Try again in ${limit.retryAfterSeconds}s.` };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const p = parsed.data;

  if (p.favoriteSymbol && !(await findInstrument(p.favoriteSymbol))) {
    const error = `We don't list ${p.favoriteSymbol}`;
    return { ok: false, error, fieldErrors: { favoriteSymbol: [error] } };
  }
  if (p.featuredBadge) {
    const unlocked = await db.userAchievement.findUnique({
      where: { userId_achievementKey: { userId: user.id, achievementKey: p.featuredBadge } },
    });
    if (!unlocked) return { ok: false, error: "You can only show off badges you've unlocked." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      displayName: p.displayName,
      bio: p.bio,
      avatarSeed: avatarValue(p.avatarStyle, p.avatarSeed),
      accentColor: p.accentColor,
      favoriteSymbol: p.favoriteSymbol,
      featuredBadge: p.featuredBadge,
    },
  });
  // The avatar shows in the header, leaderboards and feeds.
  revalidatePath("/", "layout");
  return { ok: true, data: { username: user.username } };
}
