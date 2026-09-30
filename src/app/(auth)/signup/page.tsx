import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleButton, SignUpForm } from "@/components/auth/auth-forms";
import { googleEnabled } from "@/server/auth";
import { getCurrentUser } from "@/server/users";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Claim your $10,000</h1>
        <p className="text-muted-foreground">Fake money. Real stocks. Real bragging rights.</p>
      </div>
      <SignUpForm next={typeof next === "string" ? next : undefined} />
      {googleEnabled && <GoogleButton />}
      <p className="text-center text-sm text-muted-foreground">
        Already trading?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
