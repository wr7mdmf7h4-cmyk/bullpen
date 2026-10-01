import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordPageView } from "@/server/analytics";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/users";

const bodySchema = z.object({
  path: z.string().max(2_000),
  referrer: z.string().max(2_000).default(""),
});

/**
 * Page-view beacon from the browser (components/analytics/page-view-tracker).
 * Always answers 204 so analytics can never break a page.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const raw = await req.text();
    if (raw.length > 4_096) return done;
    const parsed = bodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return done;

    const ip = await clientIp();
    if (!(await rateLimit("track", ip)).ok) return done;

    const user = await getCurrentUser();
    await recordPageView({
      path: parsed.data.path,
      referrer: parsed.data.referrer,
      userAgent: req.headers.get("user-agent") ?? "",
      ip,
      host: req.nextUrl.hostname,
      country: req.headers.get("x-vercel-ip-country"),
      userId: user?.id ?? null,
    });
  } catch (err) {
    console.warn("[track] dropped page view", err);
  }
  return done;
}
