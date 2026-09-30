"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { logOutAction } from "@/server/actions/auth";

export function UserMenu({ username, avatarSeed, isDemo }: { username: string; avatarSeed: string; isDemo: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring" aria-label="Account menu">
        <UserAvatar seed={avatarSeed} name={username} className="size-8" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium text-foreground">@{username}</div>
          {isDemo && <div className="text-xs text-muted-foreground">Shared demo account</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/u/${username}`}>
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logOutAction()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
