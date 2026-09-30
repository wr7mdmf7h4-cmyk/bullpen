import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { auth } from "./auth";
import { hashPassword } from "./auth/password";
import { joinSystemLeagues } from "./leagues/membership";

export const DEMO_EMAIL = "demo@bullpen.dev";
export const DEMO_USERNAME = "demo";

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

/** The demo account is created on demand so demo login works even without the seed. */
export async function ensureDemoUser() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing;
  const user = await db.user
    .create({ data: { email: DEMO_EMAIL, username: DEMO_USERNAME, avatarSeed: "demo-bull", isDemo: true } })
    .catch(() => db.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } }));
  await joinSystemLeagues(user.id);
  return user;
}

/** Current signed-in user (one DB read per request thanks to React `cache`). */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
});

/** For pages/actions that need a fully onboarded user. */
export async function requireUser(returnTo?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  if (!user.username) redirect("/onboarding");
  return user as typeof user & { username: string };
}
