/**
 * LemonSqueezy 集成（Merchant of Record 模式）
 * ------------------------------------------------------------
 * 优势：
 *   - 无需公司 / 营业执照，个人身份即可注册成为 Seller
 *   - 由 Lemon 处理全球税务（US sales tax / EU VAT 等）+ 退款 + chargeback
 *   - 支持信用卡 / Apple Pay / Google Pay / PayPal 多种支付方式
 *
 * 使用方式：
 *   1. 在 LemonSqueezy 后台创建 Store
 *   2. 为每个套餐创建一个 "One-time" 类型 Product，记下其 variant_id
 *   3. 创建 Webhook 指向 https://<your-domain>/api/pay/notify/lemon，记下 secret
 *   4. 在 .env.production 填好下方 env
 *
 * 必要 env：
 *   LEMONSQUEEZY_API_KEY       Settings → API → Create API Key
 *   LEMONSQUEEZY_STORE_ID      Stores 列表里那个数字 ID
 *   LEMONSQUEEZY_WEBHOOK_SECRET   Webhooks → 你创建的那条
 *   LEMONSQUEEZY_VARIANT_MONTH    月度套餐的 variant id
 *   LEMONSQUEEZY_VARIANT_QUARTER  季度
 *   LEMONSQUEEZY_VARIANT_YEAR     年度
 *
 * 详见 docs/lemonsqueezy-setup.md
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order } from "@/lib/payments/orders";
import type { PlanId } from "@/lib/payments/plans";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export class LemonSqueezyConfigError extends Error {
  constructor(missing: string) {
    super(`LemonSqueezy not configured: missing env ${missing}`);
    this.name = "LemonSqueezyConfigError";
  }
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new LemonSqueezyConfigError(key);
  return v;
}

const VARIANT_ENV_BY_PLAN: Record<PlanId, string> = {
  month: "LEMONSQUEEZY_VARIANT_MONTH",
  quarter: "LEMONSQUEEZY_VARIANT_QUARTER",
  year: "LEMONSQUEEZY_VARIANT_YEAR",
};

export function getVariantId(planId: PlanId): string {
  return requireEnv(VARIANT_ENV_BY_PLAN[planId]);
}

// ============================== checkout ============================== //

/**
 * 调用 LemonSqueezy Checkouts API 创建一次性 checkout，附带 custom data
 * 用于回调时把 LemonSqueezy 的 order 关联回我们的 out_trade_no。
 *
 * 文档：https://docs.lemonsqueezy.com/api/checkouts
 */
export async function createLemonCheckout(opts: {
  order: Order;
  baseUrl: string;
  userEmail: string;
}): Promise<{ checkoutUrl: string }> {
  const apiKey = requireEnv("LEMONSQUEEZY_API_KEY");
  const storeId = requireEnv("LEMONSQUEEZY_STORE_ID");
  const variantId = getVariantId(opts.order.plan_id as PlanId);

  const successUrl = `${opts.baseUrl}/pay/success?out_trade_no=${encodeURIComponent(opts.order.out_trade_no)}`;

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: opts.userEmail,
          custom: {
            // 这两个字段会原样回到 webhook 的 meta.custom_data
            out_trade_no: opts.order.out_trade_no,
            user_id: opts.order.user_id,
          },
        },
        product_options: {
          redirect_url: successUrl,
          // 让用户付款后自动跳回我们的成功页
          enabled_variants: [Number(variantId)],
        },
        checkout_options: {
          // 隐藏一些非必要字段，提升转化
          embed: false,
          dark: false,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LemonSqueezy checkout API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: { attributes?: { url?: string } };
  };
  const url = json?.data?.attributes?.url;
  if (!url) throw new Error("LemonSqueezy returned no checkout url");
  return { checkoutUrl: url };
}

// ============================== webhook ============================== //

/**
 * LemonSqueezy webhook 验签
 * 头部字段：
 *   X-Signature      = hex(HMAC_SHA256(webhook_secret, rawBody))
 *   X-Event-Name     = order_created / subscription_created / order_refunded ...
 *
 * 文档：https://docs.lemonsqueezy.com/help/webhooks
 */
export type LemonNotify = {
  eventName: string;
  outTradeNo: string;
  gatewayTradeNo: string;       // Lemon order id
  isPaid: boolean;
  rawPayload: string;
};

export type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: { out_trade_no?: string; user_id?: string };
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      status?: string;             // "paid" / "refunded" / "pending" / "failed"
      identifier?: string;
      order_number?: number;
      total?: number;
      currency?: string;
    };
  };
};

export function verifyLemonWebhook(opts: {
  rawBody: string;
  signatureHeader: string | null;
}): LemonWebhookPayload {
  const secret = requireEnv("LEMONSQUEEZY_WEBHOOK_SECRET");
  if (!opts.signatureHeader) {
    throw new Error("missing X-Signature header");
  }
  const expected = createHmac("sha256", secret).update(opts.rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(opts.signatureHeader.trim());
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("signature mismatch");
  }
  try {
    return JSON.parse(opts.rawBody) as LemonWebhookPayload;
  } catch {
    throw new Error("invalid JSON body");
  }
}

/**
 * 把 webhook payload 解析为我们的内部 LemonNotify 结构。
 * 只对 order_created (status=paid) 视为支付成功；其他事件返回 isPaid=false。
 */
export function parseLemonNotify(payload: LemonWebhookPayload, rawBody: string): LemonNotify {
  const eventName = payload.meta?.event_name ?? "unknown";
  const outTradeNo = payload.meta?.custom_data?.out_trade_no ?? "";
  const lemonOrderId = payload.data?.id ?? "";
  const status = payload.data?.attributes?.status ?? "";

  if (!outTradeNo) {
    throw new Error("missing custom_data.out_trade_no in webhook payload");
  }

  const isPaid = eventName === "order_created" && status === "paid";

  return {
    eventName,
    outTradeNo,
    gatewayTradeNo: `LMSQZ-${lemonOrderId}`,
    isPaid,
    rawPayload: rawBody,
  };
}
