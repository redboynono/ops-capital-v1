import { applyPaymentSuccess, markOrderFailed } from "@/lib/payments/orders";
import {
  notifyAckAlipay,
  PaymentChannelNotConfiguredError,
  PaymentVerificationError,
  verifyAlipayNotify,
  type RawNotifyRequest,
} from "@/lib/payments/gateways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alipay 异步通知回调
 *   - 真实模式：Alipay 用 form-urlencoded POST
 *   - Mock 模式：前端 /pay/mock 页 POST 一个 JSON 过来
 * 均需验签后再落库。
 */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") ?? "";

  const parsed = parseBody(rawBody, contentType);
  const rawReq: RawNotifyRequest = {
    headers: Object.fromEntries(req.headers.entries()),
    rawBody,
    ...parsed,
  };

  try {
    const notify = await verifyAlipayNotify(rawReq);

    if (notify.tradeStatus === "TRADE_SUCCESS") {
      await applyPaymentSuccess({
        outTradeNo: notify.outTradeNo,
        gatewayTradeNo: notify.gatewayTradeNo,
        payload: notify.rawPayload,
      });
    } else {
      await markOrderFailed(notify.outTradeNo, notify.rawPayload);
    }
  } catch (err) {
    if (err instanceof PaymentChannelNotConfiguredError) {
      return new Response("channel not configured", { status: 503 });
    }
    if (err instanceof PaymentVerificationError) {
      // 签名验证失败：返回非 success，Alipay 会重试（我们不会写入 DB）
      return new Response("failure", { status: 400 });
    }
    console.error("[alipay notify] unexpected:", err);
    return new Response("failure", { status: 500 });
  }

  // Alipay 只认响应体为 "success" 的纯文本才视为成功接收，否则会重试 25 次
  const ack = notifyAckAlipay();
  return new Response(ack.body, {
    status: 200,
    headers: { "Content-Type": ack.contentType },
  });
}

function parseBody(rawBody: string, contentType: string) {
  if (contentType.includes("application/json")) {
    try {
      return { json: JSON.parse(rawBody) as unknown };
    } catch {
      return { json: null };
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const form: Record<string, string> = {};
    for (const [k, v] of params.entries()) form[k] = v;
    return { form };
  }
  return {};
}
