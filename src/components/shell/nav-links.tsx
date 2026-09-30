"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BarChart3, Home, Trophy, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function navItems(username: string) {
  return [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/markets", label: "Markets", icon: BarChart3 },
    { href: "/portfolio", label: "Portfolio", icon: Wallet },
    { href: "/leagues", label: "Leagues", icon: Trophy },
    { href: `/u/${username}`, label: "Profile", icon: User },
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/markets") return pathname.startsWith("/markets") || pathname.startsWith("/stocks");
  return pathname === href || pathname.startsWith(href + "/");
}

export function DesktopNav({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {navItems(username)
        .filter((i) => i.label !== "Profile")
        .map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="desktop-nav-pill"
                  className="absolute inset-0 -z-10 rounded-lg bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

export function MobileTabBar({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {navItems(username).map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
