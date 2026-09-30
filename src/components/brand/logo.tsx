import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      {/* horns */}
      <path
        d="M7 9c0 3.5 2.2 5.5 5 5.5M25 9c0 3.5-2.2 5.5-5 5.5"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      {/* rising line */}
      <path
        d="M8 23l5-5 4 3 7-7"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">Bullpen</span>
    </Link>
  );
}
