import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { createClientTokenRequest } from "@/server/realtime";

/** Ably token auth: the API key never reaches the browser. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokenRequest = await createClientTokenRequest(session.user.id);
  if (!tokenRequest) return NextResponse.json({ error: "Realtime not configured" }, { status: 404 });
  return NextResponse.json(tokenRequest, { headers: { "Cache-Control": "private, no-store" } });
}
