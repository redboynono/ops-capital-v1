import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅允许前端上报这些漏斗事件；trial_start / subscription_paid 由 Stripe webhook 服务端触发。
const CLIENT_EVENTS = new Set([
  "paywall_hit",
  "pricing_view",
  "checkout_start",
  "email_capture",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    type?: string;
    path?: string;
    visitorId?: string;
    utmSource?: string;
    utmCampaign?: string;
    product?: string;
    slug?: string;
    planId?: string;
  } | null;

  const type = (body?.type ?? "").slice(0, 48);
  if (!CLIENT_EVENTS.has(type)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  const user = await getSessionUser();

  logEvent(type, {
    userId: user?.id ?? null,
    meta: {
      path: (body?.path ?? "").slice(0, 512) || null,
      visitor_id: (body?.visitorId ?? "").slice(0, 64) || null,
      utm_source: (body?.utmSource ?? "").slice(0, 32) || null,
      utm_campaign: (body?.utmCampaign ?? "").slice(0, 64) || null,
      product: (body?.product ?? "").slice(0, 32) || null,
      slug: (body?.slug ?? "").slice(0, 128) || null,
      plan_id: (body?.planId ?? "").slice(0, 32) || null,
      locale: req.headers.get("x-ops-locale") ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
