import {
  applyPaymentSuccess,
  createPaidOrderAndExtend,
  getOrderByOutTradeNo,
  markOrderFailed,
} from "@/lib/payments/orders";
import {
  parseGumroadPing,
  verifyGumroadSale,
  GumroadConfigError,
} from "@/lib/payments/gumroad";
import type { PlanId } from "@/lib/payments/plans";
import { mysqlQuery } from "@/lib/mysql";

/** 通过 email 反查 opscapital.com 注册用户（兜底：当 url_params 缺失时使用） */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from users where lower(email) = lower(?) limit 1",
    [email],
  );
  return rows[0]?.id ?? null;
}

/** 从 product_permalink 推断 plan_id（env 配置的 3 个 permalink 反向查）*/
function planIdFromPermalink(permalink: string): PlanId | null {
  if (permalink === process.env.GUMROAD_PERMALINK_MONTH) return "month";
  if (permalink === process.env.GUMROAD_PERMALINK_QUARTER) return "quarter";
  if (permalink === process.env.GUMROAD_PERMALINK_YEAR) return "year";
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gumroad Ping webhook
 * 文档：https://help.gumroad.com/article/280-gumroad-api#ping
 *
 * Gumroad Ping 特点：
 *   - form-urlencoded body（非 JSON）
 *   - 无原生签名机制 → 我们用「sale_id 反查 API」防伪
 *   - 订阅每个 billing cycle 触发一次 ping（首次 + 每次续费）
 *
 * 事件路由：
 *   1) 有 sale_id + is_refunded=false    → 首次购买 或 续费
 *        - url_params.out_trade_no 对应我方 pending order  → applyPaymentSuccess
 *        - 找不到 pending order（续费场景）                 → createPaidOrderAndExtend
 *   2) is_refunded=true                   → markOrderFailed（不回收剩余时长）
 *
 * 防伪：拿 sale_id 调 GET /v2/sales/:id，只有我们 access_token 对应店铺的
 *       真实销售才能查到，伪造 ping 无法通过此关。
 */
export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();

  let ping;
  try {
    ping = parseGumroadPing(rawBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse failed";
    console.warn("[gumroad ping] parse:", msg);
    return new Response(msg, { status: 400 });
  }

  if (!ping.sale_id) {
    console.warn("[gumroad ping] missing sale_id in body");
    return new Response("missing sale_id", { status: 400 });
  }

  // 防伪：反查 Gumroad API
  try {
    const verified = await verifyGumroadSale(ping.sale_id);
    if (!verified) {
      console.warn("[gumroad ping] sale_id not found via API, likely forged:", ping.sale_id);
      return new Response("sale not found", { status: 403 });
    }
    if (!verified.sellerMatches) {
      console.warn("[gumroad ping] seller_id mismatch for sale:", ping.sale_id);
      return new Response("seller mismatch", { status: 403 });
    }
  } catch (err) {
    if (err instanceof GumroadConfigError) {
      return new Response(err.message, { status: 503 });
    }
    console.error("[gumroad ping] verify failed:", err);
    return new Response("verify failed", { status: 500 });
  }

  // 退款事件：标订单为 failed（退款由 Gumroad 自动处理）
  if (ping.is_refunded) {
    const originalOutTradeNo = ping.url_params.out_trade_no;
    if (originalOutTradeNo) {
      await markOrderFailed(originalOutTradeNo, rawBody).catch((e) =>
        console.error("[gumroad ping] markFailed err:", e),
      );
    }
    return new Response("ok", { status: 200 });
  }

  // 支付成功：分首次 / 续费两条路径
  // ─── 找用户：优先用 url_params（理论值），否则用 email 兜底匹配 ───
  // Gumroad 的 /l/<permalink>?wanted=true 跳转流不保留自定义 URL params，
  // 实际生产中 url_params 多半是空的，所以 email 兜底是主路径。
  const originalOutTradeNo = ping.url_params.out_trade_no;
  let userId: string | null = ping.url_params.user_id ?? null;
  if (!userId && ping.email) {
    userId = await findUserIdByEmail(ping.email);
  }
  if (!userId) {
    console.warn(
      "[gumroad ping] cannot resolve user (url_params.user_id missing AND no matching email):",
      { email: ping.email, url_params: ping.url_params, sale_id: ping.sale_id },
    );
    // 不重试，返回 200 让 Gumroad 不再发；运营手工跟进
    return new Response("user not found", { status: 200 });
  }

  // ─── 找 plan：优先用 url_params，否则用 product_permalink 反查 ───
  const planId =
    (ping.url_params.plan_id as PlanId | undefined) ??
    planIdFromPermalink(ping.product_permalink);
  if (!planId) {
    console.warn(
      "[gumroad ping] cannot resolve plan_id from permalink:",
      ping.product_permalink,
    );
    return new Response("plan not found", { status: 200 });
  }

  const gatewayTradeNo = `GMRD-${ping.sale_id}`;

  try {
    // 首次购买：url_params.out_trade_no 对应的 pending order 存在
    if (originalOutTradeNo) {
      const pending = await getOrderByOutTradeNo(originalOutTradeNo);
      if (pending && pending.status === "pending") {
        await applyPaymentSuccess({
          outTradeNo: originalOutTradeNo,
          gatewayTradeNo,
          payload: rawBody,
        });
        return new Response("ok", { status: 200 });
      }
    }

    // 兜底路径：合成 out_trade_no 直建 paid 订单
    // 适用于：续费 ping、url_params 丢失的首次购买
    // 幂等：out_trade_no UNIQUE → Gumroad 重试同一 sale_id 不会双扣
    const syntheticOutTradeNo = gatewayTradeNo;  // "GMRD-<sale_id>"
    await createPaidOrderAndExtend({
      outTradeNo: syntheticOutTradeNo,
      userId,
      channel: "gumroad",
      planId,
      gatewayTradeNo,
      payload: rawBody,
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[gumroad ping] apply failed:", err);
    // 返回 500 → Gumroad 会重试（最多 5 次）
    return new Response("internal error", { status: 500 });
  }
}
