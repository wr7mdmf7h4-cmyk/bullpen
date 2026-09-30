import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <p className="num text-7xl font-bold text-loss">404</p>
      <h1 className="text-xl font-semibold">This page got delisted.</h1>
      <Link
        href="/dashboard"
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Back to the trading floor
      </Link>
    </main>
  );
}
