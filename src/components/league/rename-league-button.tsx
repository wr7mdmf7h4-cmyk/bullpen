"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameLeagueAction } from "@/server/actions/leagues";

export function RenameLeagueButton({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(leagueName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trimmed = name.trim();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(leagueName);
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (trimmed === leagueName) return setOpen(false);
    startTransition(async () => {
      const res = await renameLeagueAction(leagueId, trimmed);
      if (!res.ok) {
        setError(res.fieldErrors?.name?.[0] ?? res.error);
        return;
      }
      toast.success(`Renamed to “${trimmed}”`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Rename league">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename league</DialogTitle>
          <DialogDescription>Everyone in the league sees the new name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="league-name" className="text-muted-foreground">
              Name
            </Label>
            <Input
              id="league-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              minLength={3}
              maxLength={40}
              required
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "league-name-error" : undefined}
              className="h-11 rounded-xl"
            />
            {error && (
              <p id="league-name-error" className="text-xs text-loss">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || trimmed.length < 3} className="h-11 rounded-xl font-semibold">
              {pending ? <Loader2 className="animate-spin" /> : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
