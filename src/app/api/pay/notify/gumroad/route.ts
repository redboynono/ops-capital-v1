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
  const { out_trade_no: originalOutTradeNo, user_id: userId, plan_id: planId } = ping.url_params;
  if (!userId || !planId) {
    console.warn("[gumroad ping] missing url_params.user_id/plan_id:", ping.url_params);
    return new Response("missing url_params", { status: 400 });
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

    // 续费 / 无 pending order 的场景：合成新 out_trade_no 直接建 paid 订单
    const syntheticOutTradeNo = gatewayTradeNo;  // "GMRD-<sale_id>"，随 sale 唯一
    await createPaidOrderAndExtend({
      outTradeNo: syntheticOutTradeNo,
      userId,
      channel: "gumroad",
      planId: planId as PlanId,
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
