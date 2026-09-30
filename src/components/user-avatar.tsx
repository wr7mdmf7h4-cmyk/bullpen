import { cn } from "@/lib/utils";

export function avatarUrl(seed: string) {
  return `/avatar/${encodeURIComponent(seed)}`;
}

export function UserAvatar({ seed, name, className }: { seed: string; name?: string | null; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny same-origin SVG, next/image adds nothing here
    <img
      src={avatarUrl(seed)}
      alt={name ? `${name}'s avatar` : ""}
      width={40}
      height={40}
      className={cn("size-10 shrink-0 rounded-full bg-muted ring-1 ring-border", className)}
    />
  );
}
