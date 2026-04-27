import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";
import { isMockMode, signMockNotify } from "@/lib/payments/gateways";
import { formatYuan } from "@/lib/payments/plans";
import { MockPayTrigger } from "@/components/mock-pay-trigger";

export const dynamic = "force-dynamic";

/**
 * Mock 支付页：仅在 PAYMENT_MODE=mock 时可访问。
 * 模拟扫码/付款后，点"模拟支付成功"按钮，前端会用 HMAC 签名的 payload
 * POST 到 /api/pay/notify/<channel>，跟真实网关回调走同一条路径。
 */
export default async function MockPayPage({
  params,
}: {
  params: Promise<{ outTradeNo: string }>;
}) {
  if (!isMockMode()) {
    // 真实模式下不应该出现这个页面
    redirect("/pricing");
  }

  const { outTradeNo } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=/pay/mock/${outTradeNo}`);

  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) notFound();
  if (order.user_id !== user.id) notFound();

  const successSig = signMockNotify(order.out_trade_no, "TRADE_SUCCESS");
  const failedSig = signMockNotify(order.out_trade_no, "FAILED");

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-10 md:px-6">
      <header className="border-b border-border pb-4">
        <span className="label-caps">模拟支付</span>
        <h1 className="mt-1 text-2xl font-bold">
          {order.pay_channel === "alipay" ? "支付宝" : "微信"}测试通道
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          当前为 <code className="mono">PAYMENT_MODE=mock</code> 模式。真实商户凭证接入后此页面自动下线。
        </p>
      </header>

      <section className="card mt-5 p-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-muted">订单号</dt>
          <dd className="font-mono">{order.out_trade_no}</dd>

          <dt className="text-muted">金额</dt>
          <dd className="font-mono font-bold">{formatYuan(order.amount)}</dd>

          <dt className="text-muted">套餐</dt>
          <dd className="font-mono">{order.plan_id} · {order.duration_months} 个月</dd>

          <dt className="text-muted">通道</dt>
          <dd className="font-mono">{order.pay_channel}</dd>

          <dt className="text-muted">当前状态</dt>
          <dd className="font-mono">
            <span className={
              order.status === "paid" ? "text-[color:var(--success)]" :
              order.status === "failed" ? "text-[color:var(--danger)]" :
              "text-muted"
            }>
              {order.status}
            </span>
          </dd>
        </dl>
      </section>

      <MockPayTrigger
        outTradeNo={order.out_trade_no}
        channel={order.pay_channel}
        successSig={successSig}
        failedSig={failedSig}
        initialStatus={order.status}
      />

      <p className="mt-6 text-[11px] text-muted-soft">
        上线前置清单：①申请大陆营业执照 + 备案域名 ②支付宝开放平台 / 微信支付商户号 ③设置 env <code className="mono">PAYMENT_MODE=live</code> 及网关凭证 ④在 <code className="mono">src/lib/payments/gateways.ts</code> 实现 TODO 区块
      </p>
    </div>
  );
}
