import { markOrderFailed, markOrderPaid } from "@/lib/payments/orders";
import {
  parseCheckoutSession,
  parseInvoiceSubscriptionId,
  retrieveSubscription,
  StripeConfigError,
  subscriptionToSync,
  verifyStripeWebhook,
} from "@/lib/payments/stripe";
import { syncSubscriptionState } from "@/lib/payments/subscriptions";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Webhook（订阅模式 · 自动续费 + 试用）
 * 文档：https://docs.stripe.com/webhooks
 *
 * 处理事件：
 *   - checkout.session.completed         首次订阅成功 → 标记订单 paid + 同步订阅
 *   - invoice.paid                       续费扣款成功 → 同步周期结束日
 *   - customer.subscription.updated      状态变更（试用转正 / 退订标记 / 欠费）
 *   - customer.subscription.deleted      订阅终止 → 收回权益
 *   - checkout.session.expired           收银台过期 → 标记订单失败
 *
 * 本地测试：stripe listen --forward-to localhost:3000/api/pay/notify/stripe
 */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeWebhook(rawBody, signature);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify failed";
    if (err instanceof StripeConfigError) {
      console.error("[stripe webhook] not configured:", msg);
      return new Response("not configured", { status: 503 });
    }
    console.warn("[stripe webhook] verify:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const parsed = parseCheckoutSession(event);
        if (parsed?.outTradeNo && parsed.subscriptionId) {
          // 1) 标记发起订单 paid（审计）
          await markOrderPaid({
            outTradeNo: parsed.outTradeNo,
            gatewayTradeNo: parsed.subscriptionId,
            payload: JSON.stringify(event.data.object),
          });
          // 2) 拉订阅真相同步用户权益
          const sub = await retrieveSubscription(parsed.subscriptionId);
          const sync = subscriptionToSync(sub);
          if (sync) {
            await syncSubscriptionState(sync);
            console.info(
              "[stripe webhook] subscribed:",
              parsed.outTradeNo,
              sub.status,
            );
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const subId = parseInvoiceSubscriptionId(event);
        if (subId) {
          const sub = await retrieveSubscription(subId);
          const sync = subscriptionToSync(sub);
          if (sync) {
            await syncSubscriptionState(sync);
            console.info("[stripe webhook] renewed:", sub.id, sub.status);
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const sync = subscriptionToSync(sub);
        if (sync) {
          await syncSubscriptionState(sync);
          console.info("[stripe webhook]", event.type, sub.id, sub.status);
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const outTradeNo =
          session.metadata?.out_trade_no ?? session.client_reference_id;
        if (outTradeNo) await markOrderFailed(outTradeNo, rawBody);
        break;
      }

      default:
        // 其它事件忽略
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler:", err);
    return new Response("handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
