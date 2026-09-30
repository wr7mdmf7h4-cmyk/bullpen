"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { leaveLeagueAction } from "@/server/actions/leagues";

export function LeaveLeagueButton({
  leagueId,
  leagueName,
  isOwner,
}: {
  leagueId: string;
  leagueName: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      // On success the action redirects; we only get a result back on failure.
      const res = await leaveLeagueAction(leagueId);
      if (res && !res.ok) {
        toast.error(res.error);
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-loss">
          <LogOut /> Leave league
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {leagueName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Your portfolio in this league (cash, holdings and trade history) will be deleted and you&apos;ll drop off
            the leaderboard. This can&apos;t be undone.
            {isOwner && " You own this league, so ownership passes to the longest-standing member."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Stay</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              leave();
            }}
            disabled={pending}
            className="bg-loss text-background hover:bg-loss/85"
          >
            {pending ? "Leaving…" : "Leave league"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
