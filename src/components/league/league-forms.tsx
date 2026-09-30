"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeagueAction, joinLeagueAction } from "@/server/actions/leagues";
import type { ActionResult } from "@/lib/validators";
import { cn } from "@/lib/utils";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-xl font-semibold">
      {pending ? <Loader2 className="animate-spin" /> : children}
    </Button>
  );
}

function errorsOf(state: ActionResult | undefined) {
  return state && !state.ok ? (state.fieldErrors ?? {}) : {};
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function JoinLeagueForm() {
  const [state, action] = useActionState(joinLeagueAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <div className="flex gap-2">
        <Input
          name="code"
          placeholder="Invite code"
          aria-label="Invite code"
          autoCapitalize="characters"
          maxLength={10}
          className="h-11 rounded-xl font-mono tracking-widest uppercase"
          required
        />
        <Submit>Join</Submit>
      </div>
      {state && !state.ok && <p className="text-xs text-loss">{state.error}</p>}
    </form>
  );
}

export function CreateLeagueDialog() {
  const [state, action] = useActionState(createLeagueAction, undefined);
  const errors = errorsOf(state);
  const [defaults] = useState(() => {
    const start = new Date(Date.now() + 5 * 60_000);
    start.setSeconds(0, 0);
    return { start: toLocalInput(start), end: toLocalInput(new Date(start.getTime() + 14 * 86_400_000)) };
  });
  const [source, setSource] = useState<"LIVE" | "SIMULATED">("SIMULATED");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 rounded-xl font-semibold">
          <Plus /> Create league
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New private league</DialogTitle>
          <DialogDescription>Everyone who joins gets a fresh portfolio. Highest return % wins.</DialogDescription>
        </DialogHeader>
        <form
          action={(fd) => {
            // datetime-local has no zone: convert to an ISO instant in the browser's zone
            for (const k of ["startsAt", "endsAt"]) {
              const v = fd.get(k);
              if (typeof v === "string" && v) fd.set(k, new Date(v).toISOString());
            }
            action(fd);
          }}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="league-name">Name</Label>
            <Input
              id="league-name"
              name="name"
              placeholder="Office Wolves of Wall St"
              required
              maxLength={40}
              className="h-11 rounded-xl"
            />
            {errors.name && <p className="text-xs text-loss">{errors.name[0]}</p>}
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Market</legend>
            <input type="hidden" name="marketSource" value={source} />
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["SIMULATED", "24/7 Simulated", "Always open. Great for friends in any timezone."],
                  ["LIVE", "Live US market", "Real quotes, NYSE hours only."],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setSource(value)}
                  aria-pressed={source === value}
                  className={cn(
                    "grid gap-0.5 rounded-xl border p-3 text-left transition-colors",
                    source === value ? "border-primary/60 bg-primary/10" : "hover:bg-accent/50",
                  )}
                >
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="startsAt">Starts</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={defaults.start}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endsAt">Ends</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={defaults.end}
                required
                className="h-11 rounded-xl"
              />
              {errors.endsAt && <p className="text-xs text-loss">{errors.endsAt[0]}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cash">Starting $</Label>
              <Input
                id="cash"
                name="startingCashDollars"
                type="number"
                inputMode="numeric"
                defaultValue={10000}
                min={1000}
                max={1000000}
                step={1000}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="flat">Flat fee ¢</Label>
              <Input
                id="flat"
                name="feeFlatCents"
                type="number"
                inputMode="numeric"
                defaultValue={100}
                min={0}
                max={10000}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bps">Fee bps</Label>
              <Input
                id="bps"
                name="feeBps"
                type="number"
                inputMode="numeric"
                defaultValue={10}
                min={0}
                max={500}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            Default fees: $1.00 flat + 10 bps (0.10%) of each order.
          </p>
          {(errors.startingCashDollars || errors.feeFlatCents || errors.feeBps) && (
            <p className="text-xs text-loss">
              {errors.startingCashDollars?.[0] ?? errors.feeFlatCents?.[0] ?? errors.feeBps?.[0]}
            </p>
          )}
          {state && !state.ok && !Object.keys(errors).length && <p className="text-xs text-loss">{state.error}</p>}
          <Submit>Create league</Submit>
        </form>
      </DialogContent>
    </Dialog>
  );
}
