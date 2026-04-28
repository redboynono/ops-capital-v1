import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";
import { formatYuan } from "@/lib/payments/plans";

export const dynamic = "force-dynamic";

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ out_trade_no?: string }>;
}) {
  const { out_trade_no } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const order = out_trade_no ? await getOrderByOutTradeNo(out_trade_no) : null;
  const validOrder = order && order.user_id === user.id ? order : null;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-12 md:px-6">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--success-soft)] text-2xl text-[color:var(--success)]">
            ✓
          </div>
          <div>
            <span className="label-caps">Payment</span>
            <h1 className="text-2xl font-bold">
              {validOrder?.status === "paid" ? "支付成功" : "订单处理中"}
            </h1>
          </div>
        </div>

        {validOrder ? (
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-[13px]">
            <dt className="text-muted">订单号</dt>
            <dd className="font-mono">{validOrder.out_trade_no}</dd>

            <dt className="text-muted">金额</dt>
            <dd className="font-mono font-bold">{formatYuan(validOrder.amount)}</dd>

            <dt className="text-muted">套餐</dt>
            <dd className="font-mono">{validOrder.plan_id} · {validOrder.duration_months} 个月</dd>

            <dt className="text-muted">通道</dt>
            <dd className="font-mono">{validOrder.pay_channel === "alipay" ? "支付宝" : validOrder.pay_channel === "wechat" ? "微信支付" : "Gumroad"}</dd>

            <dt className="text-muted">状态</dt>
            <dd className={`font-mono font-bold ${
              validOrder.status === "paid"
                ? "text-[color:var(--success)]"
                : validOrder.status === "failed"
                  ? "text-[color:var(--danger)]"
                  : "text-muted"
            }`}>
              {validOrder.status === "paid" ? "已到账" : validOrder.status === "failed" ? "失败" : "待支付"}
            </dd>

            {validOrder.paid_at ? (
              <>
                <dt className="text-muted">支付时间</dt>
                <dd className="font-mono">{new Date(validOrder.paid_at).toLocaleString("zh-CN")}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="mt-5 text-[13px] text-muted">找不到订单信息。</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn-primary px-4 py-2 text-[13px]">
            前往会员中心
          </Link>
          <Link href="/analysis" className="btn-outline px-4 py-2 text-[13px]">
            开始阅读深度研报
          </Link>
        </div>
      </div>

      {validOrder?.status === "paid" ? (
        <p className="mt-4 text-center text-[11px] text-muted">
          感谢你成为 OPS Alpha Premium 会员。
        </p>
      ) : null}
    </div>
  );
}
