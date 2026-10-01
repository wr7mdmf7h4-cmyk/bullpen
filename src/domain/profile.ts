/** Profile customisation rules: pure functions, no I/O. */

/** Avatar styles (all rendered locally by DiceBear; see /avatar/[seed]). */
export const AVATAR_STYLES = [
  { id: "bottts-neutral", label: "Robots" },
  { id: "fun-emoji", label: "Emoji" },
  { id: "adventurer-neutral", label: "Adventurers" },
  { id: "notionists-neutral", label: "Sketches" },
  { id: "lorelei-neutral", label: "Lorelei" },
  { id: "thumbs", label: "Thumbs" },
  { id: "pixel-art", label: "Pixel art" },
  { id: "shapes", label: "Shapes" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "bottts-neutral";

/** Artwork that needs a credit (CC BY 4.0); the rest is CC0 or free for any use. */
export const AVATAR_CREDITS = [
  { style: "Fun Emoji", creator: "Davis Uche", license: "CC BY 4.0" },
  { style: "Adventurer Neutral", creator: "Lisa Wischofsky", license: "CC BY 4.0" },
] as const;

const SEPARATOR = "~";
const STYLE_IDS = new Set<string>(AVATAR_STYLES.map((s) => s.id));

function isAvatarStyle(value: string): value is AvatarStyle {
  return STYLE_IDS.has(value);
}

/**
 * The stored avatar value is "style~seed". Accounts created before styles
 * existed hold just a seed, which keeps the original robot look.
 */
export function avatarValue(style: AvatarStyle, seed: string): string {
  return `${style}${SEPARATOR}${seed}`;
}

export function parseAvatar(value: string): { style: AvatarStyle; seed: string } {
  const at = value.indexOf(SEPARATOR);
  if (at === -1) return { style: DEFAULT_AVATAR_STYLE, seed: value };
  const style = value.slice(0, at);
  return { style: isAvatarStyle(style) ? style : DEFAULT_AVATAR_STYLE, seed: value.slice(at + 1) };
}

/** Profile banner colours. */
export const ACCENTS = [
  { id: "mint", label: "Mint", color: "oklch(0.86 0.2 152)" },
  { id: "sky", label: "Sky", color: "oklch(0.78 0.14 235)" },
  { id: "violet", label: "Violet", color: "oklch(0.7 0.19 295)" },
  { id: "pink", label: "Pink", color: "oklch(0.74 0.19 350)" },
  { id: "coral", label: "Coral", color: "oklch(0.72 0.18 30)" },
  { id: "amber", label: "Amber", color: "oklch(0.83 0.16 80)" },
  { id: "lime", label: "Lime", color: "oklch(0.88 0.2 125)" },
  { id: "slate", label: "Slate", color: "oklch(0.7 0.03 260)" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export function accentColor(id: string | null | undefined): string | null {
  return ACCENTS.find((a) => a.id === id)?.color ?? null;
}

export const DISPLAY_NAME_MAX = 30;
export const BIO_MAX = 160;
