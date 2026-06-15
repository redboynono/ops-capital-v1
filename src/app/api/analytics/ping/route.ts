import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    path?: string;
    visitorId?: string;
    utmSource?: string;
  } | null;

  const path = (body?.path ?? "/").slice(0, 512);
  const visitorId = (body?.visitorId ?? "").slice(0, 64) || null;
  const utmSource = (body?.utmSource ?? "").slice(0, 32) || null;

  const user = await getSessionUser();

  logEvent("page_view", {
    userId: user?.id ?? null,
    meta: {
      path,
      visitor_id: visitorId,
      utm_source: utmSource,
      locale: req.headers.get("x-ops-locale") ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
