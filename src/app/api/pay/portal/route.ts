import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/payments/stripe";
import { getStripeCustomerId } from "@/lib/payments/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 创建 Stripe Billing Portal 会话，用户可在其中管理 / 取消订阅、更新卡片、查看发票。
 * 返回 { url }，前端跳转过去。
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) {
    return NextResponse.json(
      { error: "no_subscription", message: "尚未有订阅记录" },
      { status: 400 },
    );
  }

  try {
    const url = await createBillingPortalSession(customerId);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "portal error";
    console.error("[pay/portal]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
