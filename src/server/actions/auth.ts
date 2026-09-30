"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "../auth";
import { db } from "../db";
import { clientIp, rateLimit } from "../rate-limit";
import { createPasswordUser, getCurrentUser, UserExistsError } from "../users";
import { logInSchema, signUpSchema, usernameSchema, type ActionResult } from "@/lib/validators";

function tooMany(seconds: number): ActionResult {
  return { ok: false, error: `Too many attempts. Try again in ${seconds}s.` };
}

function safeRedirect(target: FormDataEntryValue | null): string {
  const value = typeof target === "string" ? target : "";
  // Only allow same-site relative paths to avoid open redirects.
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signUpAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const limit = await rateLimit("signup", await clientIp());
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await createPasswordUser(parsed.data);
  } catch (err) {
    if (err instanceof UserExistsError) {
      return { ok: false, error: err.message, fieldErrors: { [err.field]: [err.message] } };
    }
    throw err;
  }

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: formData.get("next") ? safeRedirect(formData.get("next")) : "/dashboard?welcome=1",
  });
  return { ok: true };
}

export async function logInAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const limit = await rateLimit("auth", await clientIp());
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const parsed = logInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeRedirect(formData.get("next")) });
    return { ok: true };
  } catch (err) {
    // signIn throws a redirect on success; only swallow genuine auth failures.
    if (err instanceof AuthError) return { ok: false, error: "Invalid email or password" };
    throw err;
  }
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function logOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function chooseUsernameAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.username) redirect("/dashboard");

  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]!.message,
      fieldErrors: { username: [parsed.error.issues[0]!.message] },
    };
  }
  const taken = await db.user.findUnique({ where: { username: parsed.data }, select: { id: true } });
  if (taken)
    return { ok: false, error: "That username is taken", fieldErrors: { username: ["That username is taken"] } };

  await db.user.update({ where: { id: user.id }, data: { username: parsed.data } });
  redirect("/dashboard?welcome=1");
}
