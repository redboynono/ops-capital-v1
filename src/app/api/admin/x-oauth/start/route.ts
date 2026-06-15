import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { buildXOAuth2AuthorizeUrl, createPkcePair, isXOAuth2Configured } from "@/lib/social/x-oauth2";

export const dynamic = "force-dynamic";

const PKCE_COOKIE = "x_oauth_pkce";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "admin required" }, { status: 401 });
  }
  if (!isXOAuth2Configured()) {
    return NextResponse.json({ error: "X_OAUTH2_CLIENT_ID / X_OAUTH2_CLIENT_SECRET missing" }, { status: 500 });
  }

  const { verifier, challenge, state } = createPkcePair();
  const jar = await cookies();
  jar.set(PKCE_COOKIE, JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildXOAuth2AuthorizeUrl(challenge, state));
}
