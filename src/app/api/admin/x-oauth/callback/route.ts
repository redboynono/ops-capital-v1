import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeXOAuth2Code } from "@/lib/social/x-oauth2";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PKCE_COOKIE = "x_oauth_pkce";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(siteUrl(`/admin/social?x_oauth_error=${encodeURIComponent(err)}`));
  }
  if (!code || !state) {
    return NextResponse.redirect(siteUrl("/admin/social?x_oauth_error=missing_code"));
  }

  const jar = await cookies();
  const raw = jar.get(PKCE_COOKIE)?.value;
  jar.delete(PKCE_COOKIE);
  if (!raw) {
    return NextResponse.redirect(siteUrl("/admin/social?x_oauth_error=missing_pkce"));
  }

  let parsed: { state?: string; verifier?: string };
  try {
    parsed = JSON.parse(raw) as { state?: string; verifier?: string };
  } catch {
    return NextResponse.redirect(siteUrl("/admin/social?x_oauth_error=bad_pkce"));
  }
  if (!parsed.verifier || parsed.state !== state) {
    return NextResponse.redirect(siteUrl("/admin/social?x_oauth_error=state_mismatch"));
  }

  try {
    await exchangeXOAuth2Code(code, parsed.verifier);
    return NextResponse.redirect(siteUrl("/admin/social?x_oauth=ok"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(siteUrl(`/admin/social?x_oauth_error=${encodeURIComponent(msg)}`));
  }
}
