/**
 * Stripe Checkout Sessions（托管收银台）
 * 文档：https://docs.stripe.com/payments/checkout
 *
 * 模式：一次性付款（mode=payment），到账后按 plan_id 续期 N 个月。
 * 与 Gumroad 订阅不同，续费需用户再次购买（可后续升级为 Stripe Subscription）。
 */

import Stripe from "stripe";
import type { Order } from "@/lib/payments/orders";
import { getPlan } from "@/lib/payments/plans";

export class StripeConfigError extends Error {
  constructor(missing: string) {
    super(`Stripe not configured: missing env ${missing}`);
    this.name = "StripeConfigError";
  }
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "https://opscapital.com").replace(/\/$/, "");
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new StripeConfigError("STRIPE_SECRET_KEY");
  return new Stripe(key);
}

/** 主支付通道（已全面切换为 Stripe） */
export function getPrimaryPayChannel(): "stripe" {
  return "stripe";
}

export async function createStripeCheckoutSession(
  order: Order,
  ctx: { userEmail: string },
): Promise<string> {
  const plan = getPlan(order.plan_id);
  if (!plan) throw new Error(`unknown plan: ${order.plan_id}`);

  const stripe = stripeClient();
  const successUrl = `${baseUrl()}/pay/success?out_trade_no=${encodeURIComponent(order.out_trade_no)}&session_id={CHECKOUT_SESSION_ID}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: ctx.userEmail,
    client_reference_id: order.out_trade_no,
    metadata: {
      out_trade_no: order.out_trade_no,
      user_id: order.user_id,
      plan_id: order.plan_id,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: order.amount,
          product_data: {
            name: `OPS Alpha · ${plan.nameZh}`,
            description: `${plan.durationMonths} 个月会员 · ${plan.product}`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: `${baseUrl()}/pricing`,
  });

  if (!session.url) throw new Error("stripe checkout session missing url");
  return session.url;
}

export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new StripeConfigError("STRIPE_WEBHOOK_SECRET");
  if (!signature) throw new Error("missing Stripe-Signature header");

  const stripe = stripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export type StripeCheckoutCompleted = {
  outTradeNo: string;
  gatewayTradeNo: string;
  payload: string;
};

/** 从 checkout.session.completed 事件解析订单号 */
export function parseCheckoutCompleted(event: Stripe.Event): StripeCheckoutCompleted | null {
  if (event.type !== "checkout.session.completed") return null;

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return null;

  const outTradeNo =
    session.metadata?.out_trade_no ??
    session.client_reference_id ??
    null;
  if (!outTradeNo) return null;

  const gatewayTradeNo = session.payment_intent
    ? String(session.payment_intent)
    : session.id;

  return {
    outTradeNo,
    gatewayTradeNo,
    payload: JSON.stringify(session),
  };
}
