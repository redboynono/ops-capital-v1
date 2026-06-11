import { NextResponse } from "next/server";
import { applyLandingLocaleCookie } from "@/lib/i18n/locale";
import { siteUrl } from "@/lib/seo";
import { resolveShortLink } from "@/lib/social/short-link";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const target = await resolveShortLink(code);
  if (!target) {
    return NextResponse.redirect(siteUrl("/"), 302);
  }
  const res = NextResponse.redirect(target, 302);
  return applyLandingLocaleCookie(res, target);
}
