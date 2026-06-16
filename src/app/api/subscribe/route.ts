import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { subscribeEmail } from "@/lib/email-subscribers";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    locale?: string;
    source?: string;
  } | null;

  const email = (body?.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
  }

  const [user, cookieStore] = await Promise.all([getSessionUser(), cookies()]);
  const utmSource = cookieStore.get("ops_utm")?.value ?? null;

  const result = await subscribeEmail({
    email,
    locale: body?.locale,
    source: body?.source,
    utmSource: utmSource ?? undefined,
    userId: user?.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // 转化漏斗：留下邮箱（仅首次留资计入，避免重复订阅刷量）
  if (result.created) {
    logEvent("email_capture", {
      userId: user?.id ?? null,
      meta: { source: body?.source ?? null, utm_source: utmSource, locale: body?.locale ?? "zh" },
    });
  }

  return NextResponse.json({ ok: true, created: result.created });
}
