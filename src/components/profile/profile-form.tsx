"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import {
  ACCENTS,
  AVATAR_CREDITS,
  AVATAR_STYLES,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  accentColor,
  avatarValue,
  type AccentId,
  type AvatarStyle,
} from "@/domain/profile";
import { updateProfileAction } from "@/server/actions/profile";
import type { FieldErrors } from "@/lib/validators";
import { cn } from "@/lib/utils";

export type ProfileFormValues = {
  displayName: string;
  bio: string;
  avatarStyle: AvatarStyle;
  avatarSeed: string;
  accentColor: AccentId | null;
  favoriteSymbol: string;
  featuredBadge: string | null;
};

type Badge = { key: string; name: string; emoji: string };

function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-xs text-loss">
      {errors[0]}
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 grid gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function ProfileForm({
  username,
  initial,
  badges,
}: {
  username: string;
  initial: ProfileFormValues;
  badges: Badge[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const avatar = avatarValue(values.avatarStyle, values.avatarSeed);
  const accent = accentColor(values.accentColor);
  const badge = badges.find((b) => b.key === values.featuredBadge);

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfileAction(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Profile saved");
      router.push(`/u/${res.data.username}`);
    });
  }

  return (
    <form onSubmit={save} className="grid gap-10">
      {/* live preview */}
      <div className="surface relative overflow-hidden p-5">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-16"
          style={{
            background: `linear-gradient(90deg, ${accent ?? "var(--primary)"}, transparent)`,
            opacity: accent ? 0.6 : 0.15,
          }}
        />
        <div className="relative flex items-center gap-4 pt-6">
          <UserAvatar seed={avatar} name={username} className="size-16 ring-2 ring-background" />
          <div className="grid min-w-0 gap-0.5">
            <span className="truncate text-xl font-semibold">{values.displayName.trim() || `@${username}`}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {values.displayName.trim() && <span>@{username}</span>}
              {badge && (
                <span className="rounded-full border px-2 py-0.5 text-xs">
                  {badge.emoji} {badge.name}
                </span>
              )}
            </span>
          </div>
        </div>
        {values.bio.trim() && (
          <p className="relative mt-3 text-sm whitespace-pre-line text-muted-foreground">{values.bio.trim()}</p>
        )}
      </div>

      <Section title="Avatar" hint="Pick a style, then shuffle until you like the face.">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {AVATAR_STYLES.map((s) => {
            const selected = s.id === values.avatarStyle;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => set("avatarStyle", s.id)}
                aria-pressed={selected}
                className={cn(
                  "grid justify-items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <UserAvatar seed={avatarValue(s.id, values.avatarSeed)} className="size-12" />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => set("avatarSeed", randomSeed())}>
            <Shuffle /> Shuffle
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Art:{" "}
            {AVATAR_CREDITS.map((c, i) => (
              <span key={c.style}>
                {i > 0 && ", "}
                {c.style} by {c.creator} ({c.license})
              </span>
            ))}
            . Others CC0 or free to use.
          </p>
        </div>
      </Section>

      <Section title="About you">
        <div className="grid gap-1.5">
          <Label htmlFor="displayName" className="text-muted-foreground">
            Display name <span className="text-xs">(optional, shown above your @username)</span>
          </Label>
          <Input
            id="displayName"
            value={values.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            placeholder={`e.g. ${username.replace(/[_\d]+/g, " ").trim() || "Warren"}`}
            aria-invalid={errors.displayName ? true : undefined}
            aria-describedby={errors.displayName ? "displayName-error" : undefined}
            className="h-11 rounded-xl"
          />
          <FieldError id="displayName-error" errors={errors.displayName} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="bio" className="text-muted-foreground">
              Bio
            </Label>
            <span className="num text-xs text-muted-foreground">
              {values.bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            id="bio"
            value={values.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="Your trading style, your worst trade, your hot take…"
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? "bio-error" : undefined}
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-loss dark:bg-input/30"
          />
          <FieldError id="bio-error" errors={errors.bio} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="favoriteSymbol" className="text-muted-foreground">
            Favourite stock
          </Label>
          <Input
            id="favoriteSymbol"
            value={values.favoriteSymbol}
            onChange={(e) => set("favoriteSymbol", e.target.value.toUpperCase())}
            maxLength={7}
            placeholder="e.g. NVDA"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={errors.favoriteSymbol ? true : undefined}
            aria-describedby={errors.favoriteSymbol ? "favoriteSymbol-error" : undefined}
            className="h-11 max-w-40 rounded-xl font-mono"
          />
          <FieldError id="favoriteSymbol-error" errors={errors.favoriteSymbol} />
        </div>
      </Section>

      <Section title="Profile colour">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Profile colour">
          {ACCENTS.map((a) => {
            const selected = values.accentColor === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={a.label}
                title={a.label}
                onClick={() => set("accentColor", selected ? null : a.id)}
                className={cn(
                  "grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-3 focus-visible:ring-ring",
                  selected && "ring-2 ring-foreground",
                )}
                style={{ background: a.color }}
              >
                {selected && <Check className="size-4 text-background" />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Showcase badge"
        hint={badges.length ? "Pin one of your badges next to your name." : "Unlock a badge to show it off here."}
      >
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Showcase badge">
            {[{ key: null, name: "None", emoji: "" }, ...badges].map((b) => {
              const selected = values.featuredBadge === b.key;
              return (
                <button
                  key={b.key ?? "none"}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set("featuredBadge", b.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    selected ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {b.emoji && <span className="mr-1">{b.emoji}</span>}
                  {b.name}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="h-11 min-w-32 rounded-xl font-semibold">
          {pending ? <Loader2 className="animate-spin" /> : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
