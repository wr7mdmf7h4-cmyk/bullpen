import { createAvatar, type Style } from "@dicebear/core";
import * as adventurerNeutral from "@dicebear/adventurer-neutral";
import * as botttsNeutral from "@dicebear/bottts-neutral";
import * as funEmoji from "@dicebear/fun-emoji";
import * as loreleiNeutral from "@dicebear/lorelei-neutral";
import * as notionistsNeutral from "@dicebear/notionists-neutral";
import * as pixelArt from "@dicebear/pixel-art";
import * as shapes from "@dicebear/shapes";
import * as thumbs from "@dicebear/thumbs";
import { parseAvatar, type AvatarStyle } from "@/domain/profile";

// Avatars are generated locally (no third-party request, no tracking) and are a
// pure function of the stored value ("style~seed", or a plain seed for the
// original robots), so they can be cached forever.
const BACKGROUNDS = ["1f3b2d", "2a2150", "3b1f2b", "1e3350", "3a3016", "123c3c"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each style has its own options type
const STYLES: Record<AvatarStyle, Style<any>> = {
  "bottts-neutral": botttsNeutral,
  "fun-emoji": funEmoji,
  "adventurer-neutral": adventurerNeutral,
  "notionists-neutral": notionistsNeutral,
  "lorelei-neutral": loreleiNeutral,
  thumbs,
  "pixel-art": pixelArt,
  shapes,
};

export async function GET(_req: Request, ctx: RouteContext<"/avatar/[seed]">) {
  const { style, seed } = parseAvatar((await ctx.params).seed.slice(0, 96));
  const svg = createAvatar(STYLES[style], {
    seed: seed.slice(0, 64),
    backgroundColor: BACKGROUNDS,
    radius: 50,
  }).toString();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
