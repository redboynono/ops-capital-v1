import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPlan, type PlanId } from "@/lib/payments/plans";
import { createPendingOrder, type PayChannel } from "@/lib/payments/orders";
import {
  createCheckout,
  isMockMode,
  PaymentChannelNotConfiguredError,
} from "@/lib/payments/gateways";
import { getStripeCustomerId, hasUsedTrial } from "@/lib/payments/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS: PayChannel[] = ["stripe", "alipay", "wechat"];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { pay_channel?: string; plan_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const channel = body.pay_channel as PayChannel | undefined;
  const planId = body.plan_id as PlanId | undefined;

  if (!channel || !CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: "pay_channel must be stripe | alipay | wechat" },
      { status: 400 },
    );
  }
  const plan = planId ? getPlan(planId) : null;
  if (!plan || !planId) {
    return NextResponse.json({ error: "invalid plan_id" }, { status: 400 });
  }

  let order;
  try {
    order = await createPendingOrder({ userId: user.id, channel, planId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "order create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 订阅模式：复用已有 Stripe customer + 仅首次订阅给试用
  let existingCustomerId: string | null = null;
  let trialEligible = false;
  if (channel === "stripe") {
    try {
      [existingCustomerId, trialEligible] = await Promise.all([
        getStripeCustomerId(user.id),
        hasUsedTrial(user.id).then((used) => !used),
      ]);
    } catch {
      /* 读取失败不阻断下单，仅按无试用处理 */
    }
  }

  try {
    const checkout = await createCheckout(order, {
      userEmail: user.email,
      existingCustomerId,
      trialEligible,
    });
    return NextResponse.json({
      ok: true,
      mock: isMockMode(),
      order: {
        out_trade_no: order.out_trade_no,
        amount: order.amount,
        duration_months: order.duration_months,
        pay_channel: order.pay_channel,
        plan_id: order.plan_id,
        status: order.status,
      },
      checkout,
    });
  } catch (err) {
    if (err instanceof PaymentChannelNotConfiguredError) {
      return NextResponse.json(
        { error: err.message, code: "channel_not_configured" },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "checkout failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
