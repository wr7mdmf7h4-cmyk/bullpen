"use client";

import { useState, useTransition } from "react";
import { Trash2, UserX } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { deleteLeagueAction, removePlayerAction } from "@/server/actions/admin";

const dangerClass = "bg-loss text-background hover:bg-loss/85";

/** Removing a player is permanent, so the admin types their username to confirm. */
export function RemovePlayerButton({ userId, confirmation }: { userId: string; confirmation: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === confirmation;

  function remove() {
    startTransition(async () => {
      const res = await removePlayerAction(userId, typed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${confirmation}`);
      setOpen(false);
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-loss">
          <UserX /> Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {confirmation} from Bullpen?</AlertDialogTitle>
          <AlertDialogDescription>
            Their account, portfolios, trades and badges are deleted for good and they drop off every leaderboard.
            Leagues they host pass to the longest-standing member; leagues left empty are deleted. They could sign up
            again with the same email. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (matches) remove();
          }}
        >
          <label htmlFor={`confirm-${userId}`} className="text-sm text-muted-foreground">
            Type <span className="font-mono text-foreground">{confirmation}</span> to confirm
          </label>
          <Input
            id={`confirm-${userId}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 rounded-xl"
          />
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              remove();
            }}
            disabled={!matches || pending}
            className={dangerClass}
          >
            {pending ? "Removing…" : "Remove player"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteLeagueButton({ leagueId, name, players }: { leagueId: string; name: string; players: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteLeagueAction(leagueId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${name}`);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-loss">
          <Trash2 /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The league and all {players} {players === 1 ? "portfolio" : "portfolios"} in it (cash, holdings and trades)
            are deleted for good. The players keep their accounts and their other leagues. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              remove();
            }}
            disabled={pending}
            className={dangerClass}
          >
            {pending ? "Deleting…" : "Delete league"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
