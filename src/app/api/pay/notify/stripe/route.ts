import { applyPaymentSuccess, markOrderFailed } from "@/lib/payments/orders";
import {
  parseCheckoutCompleted,
  StripeConfigError,
  verifyStripeWebhook,
} from "@/lib/payments/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Webhook
 * 文档：https://docs.stripe.com/webhooks
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
    if (event.type === "checkout.session.completed") {
      const completed = parseCheckoutCompleted(event);
      if (completed) {
        await applyPaymentSuccess({
          outTradeNo: completed.outTradeNo,
          gatewayTradeNo: completed.gatewayTradeNo,
          payload: completed.payload,
        });
        console.info("[stripe webhook] paid:", completed.outTradeNo);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const outTradeNo = session.metadata?.out_trade_no ?? session.client_reference_id;
      if (outTradeNo) {
        await markOrderFailed(outTradeNo, rawBody);
      }
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
