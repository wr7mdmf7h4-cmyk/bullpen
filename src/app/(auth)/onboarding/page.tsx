import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsernameForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/users";

export const metadata: Metadata = { title: "Pick a username" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.username) redirect("/dashboard");
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Pick your trader name</h1>
        <p className="text-muted-foreground">This is what your rivals will see on the leaderboard.</p>
      </div>
      <UsernameForm />
    </div>
  );
}
