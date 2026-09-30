"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown, Globe, Loader2, Timer, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveLeagueAction } from "@/server/actions/leagues";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type SwitcherLeague = { id: string; name: string; kind: "GLOBAL" | "PRACTICE" | "PRIVATE"; marketSource: "LIVE" | "SIMULATED" };

function LeagueIcon({ kind, className }: { kind: SwitcherLeague["kind"]; className?: string }) {
  const Icon = kind === "GLOBAL" ? Globe : kind === "PRACTICE" ? Timer : Users;
  return <Icon className={cn("size-4", className)} />;
}

export function LeagueSwitcher({ leagues, activeId }: { leagues: SwitcherLeague[]; activeId: string }) {
  const [pending, startTransition] = useTransition();
  const active = leagues.find((l) => l.id === activeId) ?? leagues[0];
  if (!active) return null;

  function choose(id: string) {
    if (id === activeId) return;
    startTransition(async () => {
      const res = await setActiveLeagueAction(id);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex max-w-[11rem] items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring sm:max-w-[15rem]">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LeagueIcon kind={active.kind} className="text-primary" />}
        <span className="truncate">{active.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Playing in</DropdownMenuLabel>
        {leagues.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => choose(l.id)} className="gap-2">
            <LeagueIcon kind={l.kind} className="text-muted-foreground" />
            <span className="flex-1 truncate">{l.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{l.marketSource === "LIVE" ? "Live" : "24/7"}</span>
            {l.id === active.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/leagues">Create or join a league…</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
