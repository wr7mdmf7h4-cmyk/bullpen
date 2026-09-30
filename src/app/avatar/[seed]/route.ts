import { createAvatar } from "@dicebear/core";
import * as botttsNeutral from "@dicebear/bottts-neutral";

// Avatars are generated locally (no third-party request, no tracking) and are a
// pure function of the seed, so they can be cached forever.
const BACKGROUNDS = ["1f3b2d", "2a2150", "3b1f2b", "1e3350", "3a3016", "123c3c"];

export async function GET(_req: Request, ctx: RouteContext<"/avatar/[seed]">) {
  const { seed } = await ctx.params;
  const svg = createAvatar(botttsNeutral, {
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
