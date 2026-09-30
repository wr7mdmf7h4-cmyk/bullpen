"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/join/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Bullpen league", text: "Think you can beat me? 📈", url });
        return;
      } catch {
        // share sheet dismissed: fall back to copying
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background/40 p-1.5 pl-3">
      <span className="text-xs text-muted-foreground">Invite code</span>
      <code className="flex-1 font-mono text-sm font-semibold tracking-widest">{code}</code>
      <Button size="sm" variant="secondary" onClick={share} className="rounded-lg">
        {copied ? <Check /> : <Share2 />}
        {copied ? "Link copied" : "Invite"}
      </Button>
    </div>
  );
}
