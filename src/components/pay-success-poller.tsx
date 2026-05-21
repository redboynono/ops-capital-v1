"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatYuan } from "@/lib/payments/plans";

type OrderSnapshot = {
  out_trade_no: string;
  amount: number;
  duration_months: number;
  plan_id: string;
  pay_channel: string;
  status: "pending" | "paid" | "failed";
  paid_at: string | null;
};

export function PaySuccessPoller({
  outTradeNo,
  initial,
}: {
  outTradeNo: string;
  initial: OrderSnapshot;
}) {
  const [order, setOrder] = useState(initial);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (order.status !== "pending") return;

    const tick = async () => {
      try {
        const res = await fetch(`/api/pay/order/${encodeURIComponent(outTradeNo)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: "pending" | "paid" | "failed";
          paid_at?: string | null;
        };
        setPolls((n) => n + 1);
        if (data.status === "paid") {
          setOrder((o) => ({
            ...o,
            status: "paid",
            paid_at: data.paid_at ?? new Date().toISOString(),
          }));
          window.location.reload();
        } else if (data.status === "failed") {
          setOrder((o) => ({ ...o, status: "failed" }));
        }
      } catch {
        /* ignore */
      }
    };

    tick();
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [outTradeNo, order.status]);

  const channelLabel =
    order.pay_channel === "alipay"
      ? "支付宝"
      : order.pay_channel === "wechat"
        ? "微信支付"
        : "Gumroad";

  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-2xl ${
            order.status === "paid"
              ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
              : order.status === "failed"
                ? "bg-[color:var(--danger-soft)] text-[color:var(--danger)]"
                : "bg-accent-soft text-accent-strong"
          }`}
        >
          {order.status === "paid" ? "✓" : order.status === "failed" ? "!" : "…"}
        </div>
        <div>
          <span className="label-caps">Payment</span>
          <h1 className="text-2xl font-bold">
            {order.status === "paid"
              ? "支付成功"
              : order.status === "failed"
                ? "支付未完成"
                : "正在确认支付…"}
          </h1>
        </div>
      </div>

      {order.status === "pending" ? (
        <p className="mt-4 text-[13px] text-muted">
          Gumroad 回调通常需要几秒到一分钟。页面会自动刷新（已检查 {polls} 次）。
          若超过 5 分钟仍未开通，请确认结账邮箱与注册邮箱一致，或
          <Link href="/contact" className="mx-1 text-accent-strong hover:underline">
            联系客服
          </Link>
          并提供订单号。
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-[13px]">
        <dt className="text-muted">订单号</dt>
        <dd className="font-mono">{order.out_trade_no}</dd>
        <dt className="text-muted">金额</dt>
        <dd className="font-mono font-bold">{formatYuan(order.amount)}</dd>
        <dt className="text-muted">套餐</dt>
        <dd className="font-mono">
          {order.plan_id} · {order.duration_months} 个月
        </dd>
        <dt className="text-muted">通道</dt>
        <dd className="font-mono">{channelLabel}</dd>
        <dt className="text-muted">状态</dt>
        <dd
          className={`font-mono font-bold ${
            order.status === "paid"
              ? "text-[color:var(--success)]"
              : order.status === "failed"
                ? "text-[color:var(--danger)]"
                : "text-muted"
          }`}
        >
          {order.status === "paid"
            ? "已到账"
            : order.status === "failed"
              ? "失败"
              : "待确认"}
        </dd>
        {order.paid_at ? (
          <>
            <dt className="text-muted">支付时间</dt>
            <dd className="font-mono">{new Date(order.paid_at).toLocaleString("zh-CN")}</dd>
          </>
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/dashboard" className="btn-primary px-4 py-2 text-[13px]">
          前往会员中心
        </Link>
        <Link href="/analysis" className="btn-outline px-4 py-2 text-[13px]">
          阅读深度研报
        </Link>
        {order.status === "pending" ? (
          <Link href="/pricing" className="btn-outline px-4 py-2 text-[13px]">
            返回定价页
          </Link>
        ) : null}
      </div>
    </>
  );
}
