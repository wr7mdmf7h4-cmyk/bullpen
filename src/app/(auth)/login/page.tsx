import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DemoButton, GoogleButton, LogInForm } from "@/components/auth/auth-forms";
import { googleEnabled } from "@/server/auth";
import { getCurrentUser } from "@/server/users";

export const metadata: Metadata = { title: "Log in" };

export default async function LogInPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next, error } = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">The market missed you. Probably.</p>
      </div>
      {typeof error === "string" && (
        <p role="alert" className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
          Sign-in failed. Please try again.
        </p>
      )}
      <LogInForm next={typeof next === "string" ? next : undefined} />
      <Divider />
      <div className="grid gap-3">
        {googleEnabled && <GoogleButton />}
        <DemoButton>Skip it, try the demo</DemoButton>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={typeof next === "string" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}
