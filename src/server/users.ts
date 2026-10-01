import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { auth } from "./auth";
import { hashPassword } from "./auth/password";
import { joinSystemLeagues } from "./leagues/membership";

export class UserExistsError extends Error {
  constructor(public field: "email" | "username") {
    super(field === "email" ? "An account with that email already exists" : "That username is taken");
  }
}

function newAvatarSeed() {
  return crypto.randomUUID().slice(0, 12);
}

export async function createPasswordUser(input: { email: string; username: string; password: string }) {
  const clash = await db.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true },
  });
  if (clash) throw new UserExistsError(clash.email === input.email ? "email" : "username");

  const user = await db.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash: await hashPassword(input.password),
      avatarSeed: input.username,
    },
  });
  await joinSystemLeagues(user.id);
  return user;
}

/**
 * Google sign-in without a database adapter: find the user by (verified)
 * email or create one. New Google users pick a username in /onboarding.
 */
export async function findOrCreateGoogleUser(email: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  const user = await db.user.create({ data: { email, avatarSeed: newAvatarSeed() } });
  await joinSystemLeagues(user.id);
  return user;
}

/** Current signed-in user (one DB read per request thanks to React `cache`). */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (user) await touchLastSeen(user.id, user.lastSeenAt);
  return user;
});

const LAST_SEEN_THROTTLE_MS = 2 * 60_000;

/** Records activity for the admin dashboard, at most one write every couple of minutes. */
async function touchLastSeen(userId: string, lastSeenAt: Date | null, now = new Date()) {
  if (lastSeenAt && now.getTime() - lastSeenAt.getTime() < LAST_SEEN_THROTTLE_MS) return;
  await db.user
    .update({ where: { id: userId }, data: { lastSeenAt: now } })
    .catch((e) => console.error("[users] lastSeen update failed", e));
}

/** For pages/actions that need a fully onboarded user. */
export async function requireUser(returnTo?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  if (!user.username) redirect("/onboarding");
  return user as typeof user & { username: string };
}
