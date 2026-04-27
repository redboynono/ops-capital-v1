"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { formatYuan, type Plan } from "@/lib/payments/plans";

type Props = {
  plans: Plan[];
  loggedIn: boolean;
};

type CheckoutResp = {
  ok: true;
  mock: boolean;
  order: { out_trade_no: string; amount: number; duration_months: number; pay_channel: "alipay" | "wechat"; plan_id: string };
  checkout:
    | { kind: "redirect"; payUrl: string }
    | { kind: "qrcode"; codeUrl: string };
} | { error: string; code?: string };

export function PricingCheckout({ plans, loggedIn }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<string>(plans.find((p) => p.highlight)?.id ?? plans[0].id);
  const [busy, setBusy] = useState<"alipay" | "wechat" | null>(null);
  const [qrDialog, setQrDialog] = useState<null | {
    codeUrl: string;
    outTradeNo: string;
    amount: number;
    durationMonths: number;
    isMock: boolean;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [polled, setPolled] = useState<"pending" | "paid" | "failed">("pending");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const submit = async (channel: "alipay" | "wechat") => {
    if (!loggedIn) {
      window.location.href = `/login?redirect=/pricing`;
      return;
    }
    setError(null);
    setBusy(channel);
    try {
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay_channel: channel, plan_id: selectedPlan }),
      });
      const data: CheckoutResp = await res.json();
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : `HTTP ${res.status}`);
        return;
      }

      if (data.checkout.kind === "redirect") {
        // 支付宝：直接跳转
        window.location.href = data.checkout.payUrl;
        return;
      }

      // 微信：弹二维码 + 轮询
      setQrDialog({
        codeUrl: data.checkout.codeUrl,
        outTradeNo: data.order.out_trade_no,
        amount: data.order.amount,
        durationMonths: data.order.duration_months,
        isMock: data.mock,
      });
      setPolled("pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(null);
    }
  };

  // 打开 dialog 后轮询 3s
  useEffect(() => {
    if (!qrDialog) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      return;
    }
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/order/${encodeURIComponent(qrDialog.outTradeNo)}`);
        if (!res.ok) return;
        const data = await res.json() as { status: "pending" | "paid" | "failed" };
        if (data.status === "paid") {
          setPolled("paid");
          setTimeout(() => {
            window.location.href = `/pay/success?out_trade_no=${encodeURIComponent(qrDialog.outTradeNo)}`;
          }, 800);
        } else if (data.status === "failed") {
          setPolled("failed");
        }
      } catch {
        // 静默失败继续轮询
      }
    }, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [qrDialog]);

  const closeDialog = () => setQrDialog(null);

  return (
    <div>
      {/* 套餐选择 */}
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const selected = p.id === selectedPlan;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlan(p.id)}
              className={`card p-5 text-left transition ${
                selected
                  ? "border-accent ring-1 ring-accent"
                  : "hover:border-border-strong"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="label-caps">{p.name}</p>
                  <p className="mt-1 font-mono text-3xl font-bold">
                    {formatYuan(p.amount)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {p.durationMonths} 个月 · ¥{(p.amount / p.durationMonths / 100).toFixed(0)}/月
                  </p>
                </div>
                {p.highlight ? <span className="badge-premium">PRO</span> : null}
              </div>
              {p.tagline ? (
                <p className="mt-3 text-[12px] text-[color:var(--accent-strong)]">{p.tagline}</p>
              ) : null}
              <div
                className={`mt-4 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? "border-accent bg-accent text-[color:var(--background)]" : "border-border text-transparent"
                }`}
              >
                ✓
              </div>
            </button>
          );
        })}
      </div>

      {/* 支付通道按钮 */}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => submit("alipay")}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded border border-[#1677ff]/60 bg-[#1677ff] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#0e5fd6] disabled:opacity-50"
        >
          <span className="text-lg">支</span>
          {busy === "alipay" ? "生成订单中..." : "支付宝支付"}
        </button>
        <button
          type="button"
          onClick={() => submit("wechat")}
          disabled={busy !== null}
          className="flex items-center gap-2 rounded border border-[#09bb07]/60 bg-[#09bb07] px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-[#08a006] disabled:opacity-50"
        >
          <span className="text-lg">微</span>
          {busy === "wechat" ? "生成订单中..." : "微信支付"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}

      {/* 微信扫码 Dialog */}
      {qrDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeDialog}
        >
          <div
            className="card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="label-caps">微信支付</span>
                <h2 className="mt-0.5 text-lg font-bold">请使用微信扫码支付</h2>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="text-muted hover:text-foreground"
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center">
              <div className="rounded bg-white p-3">
                <QRCodeSVG value={qrDialog.codeUrl} size={200} />
              </div>
              <p className="mt-3 font-mono text-xl font-bold">
                {formatYuan(qrDialog.amount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {qrDialog.durationMonths} 个月会员 · 订单 {qrDialog.outTradeNo}
              </p>

              {qrDialog.isMock ? (
                <a
                  href={`/pay/mock/${qrDialog.outTradeNo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 text-[11px] text-[color:var(--accent-strong)] hover:underline"
                >
                  [MOCK 模式] 点此打开模拟支付触发页 →
                </a>
              ) : null}

              <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
                {polled === "pending" ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" />
                    等待支付中... (每 3s 检查一次)
                  </>
                ) : polled === "paid" ? (
                  <span className="text-[color:var(--success)]">✓ 支付成功，跳转中...</span>
                ) : (
                  <span className="text-[color:var(--danger)]">订单失败，请重新发起</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
