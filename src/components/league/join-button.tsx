"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinLeagueAction } from "@/server/actions/leagues";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-12 w-full rounded-xl text-base font-semibold">
      {pending ? <Loader2 className="animate-spin" /> : "Join league"}
    </Button>
  );
}

export function JoinButton({ code }: { code: string }) {
  const [state, action] = useActionState(joinLeagueAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="code" value={code} />
      <Submit />
      {state && !state.ok && <p className="text-sm text-loss">{state.error}</p>}
    </form>
  );
}
