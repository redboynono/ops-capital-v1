/**
 * Gumroad 集成（Merchant of Record · 接受中国大陆卖家）
 * ------------------------------------------------------------
 * 模式：Membership（订阅）— 每个 tier 对应一个 Gumroad 产品 permalink
 *   - 月度 → 独立 membership 产品，Recurrence=Monthly
 *   - 季度 → 独立 membership 产品，Recurrence=Every 3 months
 *   - 年度 → 独立 membership 产品，Recurrence=Yearly
 *
 * 为什么 3 个独立产品而非 1 product + 3 tiers：
 *   - URL 更干净，直接 /l/<permalink>?wanted=true 不需要 tier 参数
 *   - 每个产品独立 Ping，不会因为 tier 切换引入额外边界条件
 *
 * 流程：
 *   1. 用户点 /pricing → POST /api/pay/create → 我方 DB 创建 pending order
 *   2. 返回 checkout URL：https://<username>.gumroad.com/l/<permalink>?wanted=true
 *        &out_trade_no=OPS...&user_id=<uid>&plan_id=<plan>
 *   3. 用户在 Gumroad 付款
 *   4. Gumroad POST ping 到 /api/pay/notify/gumroad（form-urlencoded）
 *   5. 我方：sale_id 反查 Gumroad API 核实 → 应用支付成功
 *
 * 订阅续费：
 *   - Gumroad 每个 billing cycle 自动扣款 + 发新 ping
 *   - 首次 ping：url_params 含 out_trade_no，用它找 pending order → 标 paid
 *   - 续费 ping：url_params 同上（Gumroad 保留原始 URL 参数），但 sale_id 不同
 *     → 我们合成新 out_trade_no = "GMRD-" + sale_id → 新建 paid order + 续期
 *
 * 幂等：orders.out_trade_no UNIQUE 约束 + applyPaymentSuccess 内部 FOR UPDATE 行锁
 */

import type { Order } from "@/lib/payments/orders";
import type { PlanId } from "@/lib/payments/plans";

const API_BASE = "https://api.gumroad.com/v2";

export class GumroadConfigError extends Error {
  constructor(missing: string) {
    super(`Gumroad not configured: missing env ${missing}`);
    this.name = "GumroadConfigError";
  }
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new GumroadConfigError(key);
  return v;
}

const PERMALINK_ENV_BY_PLAN: Record<PlanId, string> = {
  month: "GUMROAD_PERMALINK_MONTH",
  quarter: "GUMROAD_PERMALINK_QUARTER",
  year: "GUMROAD_PERMALINK_YEAR",
};

export function getPermalink(planId: PlanId): string {
  return requireEnv(PERMALINK_ENV_BY_PLAN[planId]);
}

// ============================== checkout ============================== //

/**
 * 构造 Gumroad 托管收银台 URL
 * 文档：https://help.gumroad.com/article/280-gumroad-api（URL params 会回到 ping 的 url_params）
 */
export function buildGumroadCheckoutUrl(order: Order): string {
  const username = requireEnv("GUMROAD_USERNAME");
  const permalink = getPermalink(order.plan_id as PlanId);

  const params = new URLSearchParams({
    wanted: "true",                     // Gumroad 标准参数：直接进入支付页
    out_trade_no: order.out_trade_no,   // ↓↓↓ 这些将在 ping 的 url_params 中回传 ↓↓↓
    user_id: order.user_id,
    plan_id: order.plan_id,
  });
  return `https://${username}.gumroad.com/l/${permalink}?${params.toString()}`;
}

// ============================== ping (webhook) ============================== //

/**
 * Gumroad Ping payload（form-urlencoded）
 * 文档：https://help.gumroad.com/article/280-gumroad-api#ping
 *
 * 关键字段：
 *   seller_id, product_id, product_permalink, product_name
 *   sale_id, purchase_id, sale_timestamp
 *   subscription_id（membership 才有）
 *   price（美元分）, currency, quantity
 *   email, full_name
 *   url_params[out_trade_no], url_params[user_id], url_params[plan_id]（我们传的）
 *   refunded, disputed, test
 *   recurrence（monthly/yearly/etc），is_recurring_charge（"true"/"false"）
 */
export type GumroadPing = {
  sale_id: string;
  seller_id: string;
  product_permalink: string;
  product_name?: string;
  subscription_id?: string;
  is_recurring_charge: boolean;
  is_refunded: boolean;
  is_test: boolean;
  price_cents: number;
  currency: string;
  email?: string;
  url_params: {
    out_trade_no?: string;
    user_id?: string;
    plan_id?: string;
  };
  raw: Record<string, string>;
};

/** 解析 form-urlencoded body 为 GumroadPing 结构 */
export function parseGumroadPing(rawBody: string): GumroadPing {
  const params = new URLSearchParams(rawBody);
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) raw[k] = v;

  // Gumroad 的 url_params 用 `url_params[key]=value` 语法
  const urlParams: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    const m = k.match(/^url_params\[(.+)\]$/);
    if (m) urlParams[m[1]] = v;
  }

  return {
    sale_id: raw.sale_id ?? raw.purchase_id ?? "",
    seller_id: raw.seller_id ?? "",
    product_permalink: raw.product_permalink ?? raw.permalink ?? "",
    product_name: raw.product_name,
    subscription_id: raw.subscription_id || undefined,
    is_recurring_charge: raw.is_recurring_charge === "true",
    is_refunded: raw.refunded === "true" || raw.dispute === "true",
    is_test: raw.test === "true",
    price_cents: Number(raw.price ?? "0"),
    currency: raw.currency ?? "usd",
    email: raw.email,
    url_params: urlParams,
    raw,
  };
}

/**
 * 防伪：拿 sale_id 反查 Gumroad API，用我们的 access token
 * 只有真正在我们店铺卖出的 sale 才能被我们的 token 查到，伪造 ping 无法通过此关
 * 文档：https://app.gumroad.com/api#get-/sales/:id
 */
export async function verifyGumroadSale(saleId: string): Promise<{
  ok: boolean;
  sellerMatches: boolean;
  raw: unknown;
} | null> {
  const token = requireEnv("GUMROAD_ACCESS_TOKEN");
  const expectedSellerId = process.env.GUMROAD_SELLER_ID;   // 可选：店铺 ID 额外校验

  const res = await fetch(`${API_BASE}/sales/${encodeURIComponent(saleId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Gumroad verify API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    sale?: { seller_id?: string; id?: string };
  };

  if (!json.success) return null;

  const sellerMatches = !expectedSellerId || json.sale?.seller_id === expectedSellerId;

  return {
    ok: true,
    sellerMatches,
    raw: json,
  };
}
