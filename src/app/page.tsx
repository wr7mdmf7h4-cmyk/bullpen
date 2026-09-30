import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DemoButton } from "@/components/auth/auth-forms";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/login">Log in</Link>
        </Button>
      </header>
      <section className="grid flex-1 place-content-center gap-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Trade real stocks with fake money.</h1>
        <div className="mx-auto w-full max-w-xs">
          <DemoButton />
        </div>
      </section>
    </main>
  );
}
