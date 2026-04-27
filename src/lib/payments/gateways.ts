/**
 * 支付网关适配层
 * ------------------------------------------------------------
 * 两种运行模式（由 `PAYMENT_MODE` env 控制）：
 *
 *   - mock  ：不调任何外部 SDK。createCheckout 返回指向 /pay/mock/<out_trade_no>
 *             的本地页面，供开发 / 上线初期在没有商户凭证时打通全链路。
 *             verifyNotify 只校验 mock_secret（共享密钥）。
 *
 *   - live  ：真实调用支付宝 / 微信支付 SDK。此时必须配齐对应 env，
 *             否则抛出 PaymentChannelNotConfiguredError，由调用方响应 503。
 *
 * 扩展提示：
 *   安装 alipay-sdk 和 wechatpay-node-v3 后，把 `createLiveAlipayCheckout`
 *   与 `createLiveWechatCheckout` 内的 TODO 区块替换为真实实现即可。
 */

import type { Order } from "@/lib/payments/orders";
import { buildGumroadCheckoutUrl } from "@/lib/payments/gumroad";

export type CheckoutResult =
  | { kind: "redirect"; payUrl: string }        // 支付宝 PC / Gumroad → 直接跳转
  | { kind: "qrcode"; codeUrl: string };        // 微信 Native → 前端渲染二维码

export class PaymentChannelNotConfiguredError extends Error {
  constructor(channel: string) {
    super(`payment channel "${channel}" not configured (set PAYMENT_MODE=mock for skeleton testing)`);
    this.name = "PaymentChannelNotConfiguredError";
  }
}

export class PaymentVerificationError extends Error {
  constructor(reason: string) {
    super(`payment verification failed: ${reason}`);
    this.name = "PaymentVerificationError";
  }
}

const MODE = (process.env.PAYMENT_MODE ?? "mock") as "mock" | "live";
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

function mockSecret(): string {
  // 用 SESSION_SECRET 派生出一个与会话密钥绑定的签名密钥；生产 live 模式不使用它
  return (process.env.SESSION_SECRET ?? "dev-mock-secret").slice(0, 32);
}

// ============================== create ============================== //

export async function createCheckout(
  order: Order,
  ctx: { userEmail: string },
): Promise<CheckoutResult> {
  if (MODE === "mock") {
    return createMockCheckout(order);
  }
  if (order.pay_channel === "gumroad") {
    // Gumroad 走我们自己构造的托管收银台 URL（无需调 API 创建 checkout session）
    return { kind: "redirect", payUrl: buildGumroadCheckoutUrl(order) };
  }
  if (order.pay_channel === "alipay") return createLiveAlipayCheckout(order);
  if (order.pay_channel === "wechat") return createLiveWechatCheckout(order);
  throw new Error(`unknown pay_channel: ${order.pay_channel}`);
}

function createMockCheckout(order: Order): CheckoutResult {
  const mockUrl = `${BASE_URL}/pay/mock/${order.out_trade_no}`;
  // alipay / lemon 都走 redirect 流；wechat 走二维码流
  if (order.pay_channel === "wechat") {
    return { kind: "qrcode", codeUrl: mockUrl };
  }
  return { kind: "redirect", payUrl: mockUrl };
}

// ─────────── live stubs（接真 SDK 时在此实现） ─────────── //

async function createLiveAlipayCheckout(_order: Order): Promise<CheckoutResult> {
  // TODO: 接入 alipay-sdk：
  //   const AlipaySdk = (await import("alipay-sdk")).default;
  //   const sdk = new AlipaySdk({ appId, privateKey, alipayPublicKey, gateway: 'https://openapi.alipay.com/gateway.do' });
  //   const payUrl = sdk.pageExec("alipay.trade.page.pay", {
  //     notify_url: `${BASE_URL}/api/pay/notify/alipay`,
  //     return_url: `${BASE_URL}/pay/success?out_trade_no=${order.out_trade_no}`,
  //     bizContent: {
  //       out_trade_no: order.out_trade_no,
  //       total_amount: (order.amount / 100).toFixed(2),
  //       subject: `OPS Alpha · ${order.plan_id}`,
  //       product_code: "FAST_INSTANT_TRADE_PAY",
  //     },
  //   });
  //   return { kind: "redirect", payUrl };
  throw new PaymentChannelNotConfiguredError("alipay");
}

async function createLiveWechatCheckout(_order: Order): Promise<CheckoutResult> {
  // TODO: 接入 wechatpay-node-v3：
  //   const WxPay = (await import("wechatpay-node-v3")).default;
  //   const pay = new WxPay({ appid, mchid, publicKey, privateKey, serial_no });
  //   const res = await pay.transactions_native({
  //     description: `OPS Alpha · ${order.plan_id}`,
  //     out_trade_no: order.out_trade_no,
  //     notify_url: `${BASE_URL}/api/pay/notify/wechat`,
  //     amount: { total: order.amount, currency: "CNY" },
  //   });
  //   return { kind: "qrcode", codeUrl: res.data.code_url };
  throw new PaymentChannelNotConfiguredError("wechat");
}

// ============================== verify ============================== //

/**
 * 解析并验签回调 payload。返回 { outTradeNo, gatewayTradeNo, rawPayload } 用于 applyPaymentSuccess。
 * 验签失败必须抛 PaymentVerificationError。
 */
export type VerifiedNotify = {
  outTradeNo: string;
  gatewayTradeNo: string;          // alipay.trade_no / wechat.transaction_id
  tradeStatus: "TRADE_SUCCESS" | "FAILED";
  rawPayload: string;
};

export type RawNotifyRequest = {
  headers: Record<string, string | null>;
  rawBody: string;
  form?: Record<string, string>;    // alipay 用 form-urlencoded
  json?: unknown;                   // wechat 用 JSON
  query?: Record<string, string>;
};

export async function verifyAlipayNotify(req: RawNotifyRequest): Promise<VerifiedNotify> {
  if (MODE === "mock") {
    return verifyMockNotify(req);
  }
  // TODO: 接入 alipay-sdk：sdk.checkNotifySign(req.form) → 抛错 or 返回解析结果
  throw new PaymentChannelNotConfiguredError("alipay");
}

export async function verifyWechatNotify(req: RawNotifyRequest): Promise<VerifiedNotify> {
  if (MODE === "mock") {
    return verifyMockNotify(req);
  }
  // TODO: 接入 wechatpay-node-v3：使用 Wechatpay-Serial + Wechatpay-Signature + Wechatpay-Timestamp + Wechatpay-Nonce
  //        header 对 rawBody 做 SHA256-RSA 验签，然后用 APIv3_KEY AEAD 解密 resource
  throw new PaymentChannelNotConfiguredError("wechat");
}

function verifyMockNotify(req: RawNotifyRequest): VerifiedNotify {
  // Mock 协议：
  //   POST /api/pay/notify/<channel>
  //   body JSON: { out_trade_no, trade_status: "TRADE_SUCCESS" | "FAILED", gateway_trade_no, mock_signature }
  //   mock_signature = hmac_sha256(SESSION_SECRET, `${out_trade_no}|${trade_status}`) in hex
  const body = req.json as Record<string, string> | null;
  if (!body) throw new PaymentVerificationError("mock: empty body");

  const { out_trade_no, trade_status, gateway_trade_no, mock_signature } = body;
  if (!out_trade_no || !trade_status || !mock_signature) {
    throw new PaymentVerificationError("mock: missing fields");
  }

  // 验签
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
  const expected = createHmac("sha256", mockSecret())
    .update(`${out_trade_no}|${trade_status}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(mock_signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new PaymentVerificationError("mock: bad signature");
  }

  return {
    outTradeNo: out_trade_no,
    gatewayTradeNo: gateway_trade_no || `MOCK-${out_trade_no}`,
    tradeStatus: trade_status === "TRADE_SUCCESS" ? "TRADE_SUCCESS" : "FAILED",
    rawPayload: req.rawBody,
  };
}

/**
 * 给 mock / dev 工具用的本地签名器。生产 live 模式下不会走到这里。
 */
export function signMockNotify(outTradeNo: string, tradeStatus: "TRADE_SUCCESS" | "FAILED"): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  return createHmac("sha256", mockSecret()).update(`${outTradeNo}|${tradeStatus}`).digest("hex");
}

// ============================== response bodies ============================== //

/** 网关要求的"已收到成功"响应体（Alipay: "success" 纯文本 / WeChat V3: JSON） */
export function notifyAckAlipay(): { body: string; contentType: string } {
  return { body: "success", contentType: "text/plain; charset=utf-8" };
}
export function notifyAckWechat(): { body: string; contentType: string } {
  return {
    body: JSON.stringify({ code: "SUCCESS", message: "OK" }),
    contentType: "application/json; charset=utf-8",
  };
}

export function isMockMode(): boolean {
  return MODE === "mock";
}
