import { Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/domain/achievements";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function AchievementGrid({ unlocked, compact }: { unlocked: Map<string, Date>; compact?: boolean }) {
  return (
    <ul
      className={cn("grid gap-3", compact ? "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9" : "grid-cols-2 sm:grid-cols-3")}
    >
      {ACHIEVEMENTS.map((a) => {
        const at = unlocked.get(a.key);
        return (
          <li
            key={a.key}
            title={`${a.name}: ${a.description}`}
            className={cn(
              "surface relative grid justify-items-center gap-1.5 p-4 text-center transition-colors",
              at ? "border-gold/30 bg-gradient-to-b from-gold/[0.07] to-card" : "opacity-55",
              compact && "p-3",
            )}
          >
            <span className={cn("text-3xl", !at && "grayscale", compact && "text-2xl")} aria-hidden>
              {a.emoji}
            </span>
            <span className={cn("text-sm font-semibold", compact && "text-xs")}>{a.name}</span>
            {!compact && <span className="text-xs text-muted-foreground">{a.description}</span>}
            {!compact &&
              (at ? (
                <span className="text-[11px] text-gold">Unlocked {dateFmt.format(at)}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="size-3" /> Locked
                </span>
              ))}
            <span className="sr-only">{at ? "Unlocked" : "Locked"}</span>
          </li>
        );
      })}
    </ul>
  );
}
