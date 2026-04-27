import { applyPaymentSuccess, markOrderFailed } from "@/lib/payments/orders";
import {
  parseLemonNotify,
  verifyLemonWebhook,
  LemonSqueezyConfigError,
} from "@/lib/payments/lemon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LemonSqueezy webhook
 * 文档：https://docs.lemonsqueezy.com/help/webhooks
 *
 * 事件覆盖：
 *   order_created (status=paid)  → 标记订单 paid 并续期会员
 *   order_refunded               → 标记订单 failed（不退会员，保留剩余时长）
 *   subscription_*               → 暂不处理（我们用一次性 buyout 模型）
 *
 * 验签：X-Signature = hex(HMAC_SHA256(LEMONSQUEEZY_WEBHOOK_SECRET, rawBody))
 */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-signature");

  let payload;
  try {
    payload = verifyLemonWebhook({ rawBody, signatureHeader });
  } catch (err) {
    if (err instanceof LemonSqueezyConfigError) {
      return new Response(err.message, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "verification failed";
    console.warn("[lemon webhook] reject:", msg);
    return new Response(msg, { status: 400 });
  }

  let notify;
  try {
    notify = parseLemonNotify(payload, rawBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse failed";
    console.warn("[lemon webhook] parse:", msg);
    return new Response(msg, { status: 400 });
  }

  try {
    if (notify.eventName === "order_refunded") {
      // 退款事件：保留会员到期时间不变（已经覆盖的天数不收回），只把订单标 failed
      await markOrderFailed(notify.outTradeNo, notify.rawPayload);
    } else if (notify.isPaid) {
      await applyPaymentSuccess({
        outTradeNo: notify.outTradeNo,
        gatewayTradeNo: notify.gatewayTradeNo,
        payload: notify.rawPayload,
      });
    } else {
      // 其他事件（subscription_*、order_created 但 status!=paid 等），只记录日志
      console.log("[lemon webhook] ignore:", notify.eventName, notify.outTradeNo);
    }
  } catch (err) {
    console.error("[lemon webhook] apply:", err);
    // 返回 500 让 LemonSqueezy 重试（最多 4 次：5min, 30min, 2h, 5h）
    return new Response("internal error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
