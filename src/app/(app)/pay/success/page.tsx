import Link from "next/link";
import { redirect } from "next/navigation";
import { PaySuccessPoller } from "@/components/pay-success-poller";
import { getSessionUser } from "@/lib/auth";
import { getOrderByOutTradeNo } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ out_trade_no?: string }>;
}) {
  const { out_trade_no } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/pay/success");

  const order = out_trade_no ? await getOrderByOutTradeNo(out_trade_no) : null;
  const validOrder = order && order.user_id === user.id ? order : null;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-12 md:px-6">
      <div className="card p-6">
        {validOrder ? (
          <PaySuccessPoller
            outTradeNo={validOrder.out_trade_no}
            initial={{
              out_trade_no: validOrder.out_trade_no,
              amount: validOrder.amount,
              duration_months: validOrder.duration_months,
              plan_id: validOrder.plan_id,
              pay_channel: validOrder.pay_channel,
              status: validOrder.status,
              paid_at: validOrder.paid_at,
            }}
          />
        ) : (
          <>
            <h1 className="text-2xl font-bold">订单处理中</h1>
            <p className="mt-5 text-[13px] text-muted">找不到订单信息。</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/pricing" className="btn-primary px-4 py-2 text-[13px]">
                返回定价页
              </Link>
              <Link href="/dashboard" className="btn-outline px-4 py-2 text-[13px]">
                会员中心
              </Link>
            </div>
          </>
        )}
      </div>

      {validOrder?.status === "paid" ? (
        <p className="mt-4 text-center text-[11px] text-muted">
          感谢你成为 OPS Alpha Premium 会员。
        </p>
      ) : null}
    </div>
  );
}
