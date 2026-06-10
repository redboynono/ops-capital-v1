import { NextResponse } from "next/server";
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
  return NextResponse.redirect(target, 302);
}
