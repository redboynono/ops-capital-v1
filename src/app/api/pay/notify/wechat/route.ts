import { applyPaymentSuccess, markOrderFailed } from "@/lib/payments/orders";
import {
  notifyAckWechat,
  PaymentChannelNotConfiguredError,
  PaymentVerificationError,
  verifyWechatNotify,
  type RawNotifyRequest,
} from "@/lib/payments/gateways";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WeChat Pay V3 异步通知
 *   - 真实模式：body 是 AES-GCM 加密的 JSON，header 含 Wechatpay-Signature 等
 *   - Mock 模式：直接 JSON
 * 响应体必须是 JSON { code: "SUCCESS", message: "OK" }，非 200 微信会重试。
 */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();

  let json: unknown = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    // 真实模式 body 可能也是 JSON（加密后再 base64），parse 会通过；单纯空 body 才走这里
  }

  const rawReq: RawNotifyRequest = {
    headers: Object.fromEntries(req.headers.entries()),
    rawBody,
    json,
  };

  try {
    const notify = await verifyWechatNotify(rawReq);

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
      return Response.json({ code: "FAIL", message: "channel not configured" }, { status: 503 });
    }
    if (err instanceof PaymentVerificationError) {
      return Response.json({ code: "FAIL", message: "signature verification failed" }, { status: 400 });
    }
    console.error("[wechat notify] unexpected:", err);
    return Response.json({ code: "FAIL", message: "internal error" }, { status: 500 });
  }

  const ack = notifyAckWechat();
  return new Response(ack.body, { status: 200, headers: { "Content-Type": ack.contentType } });
}
