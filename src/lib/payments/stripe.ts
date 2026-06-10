/**
 * Stripe 订阅（Checkout subscription 模式 · 自动续费 + 免费试用）
 * 文档：https://docs.stripe.com/billing/subscriptions/build-subscriptions
 *
 * 模型：mode=subscription，按 plan 的 recurring 周期自动续费。
 *   - 新用户首次订阅赠送 TRIAL_DAYS 天免费试用（trialing → 到期自动扣款）
 *   - 续费、退订、欠费等生命周期由 Webhook 同步到 users（subscriptions.ts）
 */

import Stripe from "stripe";
import type { Order } from "@/lib/payments/orders";
import { getPlan, recurringForPlan, TRIAL_DAYS } from "@/lib/payments/plans";
import type { SubscriptionSync } from "@/lib/payments/subscriptions";

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

export type StripeCheckoutContext = {
  userEmail: string;
  /** 复用已有 Stripe customer（老用户再次订阅 / 升级） */
  existingCustomerId?: string | null;
  /** 是否给予免费试用（仅首次订阅的用户） */
  trialEligible?: boolean;
};

/**
 * 创建订阅 Checkout Session，返回托管收银台 URL。
 * 价格用 inline price_data（带 recurring），无需预建 Stripe Price。
 */
export async function createStripeCheckoutSession(
  order: Order,
  ctx: StripeCheckoutContext,
): Promise<string> {
  const plan = getPlan(order.plan_id);
  if (!plan) throw new Error(`unknown plan: ${order.plan_id}`);

  const stripe = stripeClient();
  const recurring = recurringForPlan(order.plan_id);
  const successUrl = `${baseUrl()}/pay/success?out_trade_no=${encodeURIComponent(order.out_trade_no)}&session_id={CHECKOUT_SESSION_ID}`;

  const metadata = {
    out_trade_no: order.out_trade_no,
    user_id: order.user_id,
    plan_id: order.plan_id,
  };

  const withTrial = Boolean(ctx.trialEligible) && TRIAL_DAYS > 0;
  const trialFields = withTrial
    ? {
        trial_period_days: TRIAL_DAYS,
        // 试用期结束时若无有效支付方式则取消（而不是把订阅挂起）
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" as const },
        },
      }
    : {};

  // 复用老 customer；否则用邮箱预填（Stripe 会新建 customer）
  const customerFields = ctx.existingCustomerId
    ? { customer: ctx.existingCustomerId }
    : { customer_email: ctx.userEmail };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: order.out_trade_no,
    metadata,
    subscription_data: { metadata, ...trialFields },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: order.amount,
          recurring,
          product_data: {
            name: `OPS Alpha · ${plan.nameZh}`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: `${baseUrl()}/pricing`,
    allow_promotion_codes: true,
    ...customerFields,
  });

  if (!session.url) throw new Error("stripe checkout session missing url");
  return session.url;
}

/** 创建 Billing Portal 会话（用户自助管理 / 退订） */
export async function createBillingPortalSession(
  customerId: string,
): Promise<string> {
  const stripe = stripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl()}/dashboard/profile`,
  });
  return session.url;
}

export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new StripeConfigError("STRIPE_WEBHOOK_SECRET");
  if (!signature) throw new Error("missing Stripe-Signature header");

  const stripe = stripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** 从 Subscription 对象读取当前周期结束时间（兼容新旧 API 字段位置） */
function readPeriodEnd(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof top === "number") return top;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  if (item && typeof item.current_period_end === "number") return item.current_period_end;
  return null;
}

/** 把 Stripe Subscription 归一化成 SubscriptionSync（user_id/plan_id 来自 metadata） */
export function subscriptionToSync(sub: Stripe.Subscription): SubscriptionSync | null {
  const userId = sub.metadata?.user_id;
  const planId = sub.metadata?.plan_id;
  if (!userId || !planId) return null;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";

  return {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    currentPeriodEnd: readPeriodEnd(sub),
    planId,
    trialing: sub.status === "trialing",
  };
}

/** 按 id 拉取订阅（invoice / checkout 事件只带 subscription id 时用） */
export async function retrieveSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = stripeClient();
  return stripe.subscriptions.retrieve(subscriptionId);
}

/** 从 checkout.session.completed 取订单号 + subscription id */
export function parseCheckoutSession(event: Stripe.Event): {
  outTradeNo: string | null;
  subscriptionId: string | null;
  customerId: string | null;
} | null {
  if (event.type !== "checkout.session.completed") return null;
  const session = event.data.object as Stripe.Checkout.Session;

  const outTradeNo =
    session.metadata?.out_trade_no ?? session.client_reference_id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  return { outTradeNo, subscriptionId, customerId };
}

/** 从 invoice 事件取 subscription id */
export function parseInvoiceSubscriptionId(event: Stripe.Event): string | null {
  const invoice = event.data.object as Stripe.Invoice;
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
