"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useDict } from "@/components/locale-provider";
import { fmt } from "@/lib/i18n/fmt";
import { formatYuan, type Plan } from "@/lib/payments/plans";

const PAY_CHANNEL = "stripe" as const;

type Props = {
  plans: Plan[];
  loggedIn: boolean;
  userEmail?: string | null;
  showAltChannels: boolean;
  /** 首次订阅可享免费试用 */
  trialEligible?: boolean;
  /** 免费试用天数（0 表示关闭） */
  trialDays?: number;
};

type CheckoutResp = {
  ok: true;
  mock: boolean;
  order: { out_trade_no: string; amount: number; duration_months: number; pay_channel: "alipay" | "wechat" | "gumroad" | "stripe"; plan_id: string };
  checkout:
    | { kind: "redirect"; payUrl: string }
    | { kind: "qrcode"; codeUrl: string };
} | { error: string; code?: string };

export function PricingCheckout({
  plans,
  loggedIn,
  userEmail,
  showAltChannels,
  trialEligible = false,
  trialDays = 0,
}: Props) {
  const dict = useDict();
  const c = dict.pricing.checkout;
  const showTrial = trialEligible && trialDays > 0;
  const [selectedPlan, setSelectedPlan] = useState<string>(
    plans.find((p) => p.highlight)?.id ?? plans[0].id,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [qrDialog, setQrDialog] = useState<null | {
    codeUrl: string;
    outTradeNo: string;
    amount: number;
    durationMonths: number;
    isMock: boolean;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [polled, setPolled] = useState<"pending" | "paid" | "failed">("pending");
  const [pendingRedirect, setPendingRedirect] = useState<null | {
    url: string;
    outTradeNo: string;
  }>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const submit = async (channel: typeof PAY_CHANNEL | "alipay" | "wechat") => {
    if (!loggedIn) {
      window.location.href = `/login?redirect=/pricing`;
      return;
    }
    setError(null);
    setPendingRedirect(null);
    setBusy(channel);

    // 先打开一个空白窗口（user gesture 同步触发，避免被弹窗拦截）。
    // 拿到 payUrl 后再赋值 location.href。
    const popup = channel === "stripe" ? window.open("about:blank", "_blank") : null;

    try {
      const res = await fetch("/api/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay_channel: channel, plan_id: selectedPlan }),
      });
      const data: CheckoutResp = await res.json();
      if (!res.ok || "error" in data) {
        if (popup) popup.close();
        setError("error" in data ? data.error : `HTTP ${res.status}`);
        return;
      }

      if (data.checkout.kind === "redirect") {
        // Stripe → 新标签页打开 + 在当前页留兜底链接
        if (popup) {
          popup.location.href = data.checkout.payUrl;
        } else {
          window.location.href = data.checkout.payUrl;
          return;
        }
        setPendingRedirect({
          url: data.checkout.payUrl,
          outTradeNo: data.order.out_trade_no,
        });
        return;
      }

      // qrcode（微信 / mock）
      if (popup) popup.close();
      setQrDialog({
        codeUrl: data.checkout.codeUrl,
        outTradeNo: data.order.out_trade_no,
        amount: data.order.amount,
        durationMonths: data.order.duration_months,
        isMock: data.mock,
      });
      setPolled("pending");
    } catch (e) {
      if (popup) popup.close();
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(null);
    }
  };

  // QR dialog 打开时每 3s 轮询一次订单状态
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
        const data = (await res.json()) as { status: "pending" | "paid" | "failed" };
        if (data.status === "paid") {
          setPolled("paid");
          setTimeout(() => {
            window.location.href = `/pay/success?out_trade_no=${encodeURIComponent(qrDialog.outTradeNo)}`;
          }, 800);
        } else if (data.status === "failed") {
          setPolled("failed");
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [qrDialog]);

  // Stripe 新标签支付：轮询 pending 订单，到账后跳转成功页
  useEffect(() => {
    if (!pendingRedirect) return;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/pay/order/${encodeURIComponent(pendingRedirect.outTradeNo)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { status: "pending" | "paid" | "failed" };
        if (data.status === "paid") {
          window.location.href = `/pay/success?out_trade_no=${encodeURIComponent(pendingRedirect.outTradeNo)}`;
        } else if (data.status === "failed") {
          setError(c.payFailRetry);
          setPendingRedirect(null);
        }
      } catch {
        /* ignore */
      }
    };

    tick();
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [pendingRedirect]);

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
                selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="label-caps">{p.name}</p>
                  <p className="mt-1 font-mono text-3xl font-bold">{formatYuan(p.amount)}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {fmt(c.planMonthsFmt, {
                      n: p.durationMonths,
                      price: (p.amount / p.durationMonths / 100).toFixed(2),
                    })}
                  </p>
                </div>
                {p.highlight ? <span className="badge-premium">PRO</span> : null}
              </div>
              {p.tagline ? (
                <p className="mt-3 text-[12px] text-[color:var(--accent-strong)]">{p.tagline}</p>
              ) : null}
              <div
                className={`mt-4 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                  selected
                    ? "border-accent bg-accent text-[color:var(--background)]"
                    : "border-border text-transparent"
                }`}
              >
                ✓
              </div>
            </button>
          );
        })}
      </div>

      {/* 主支付按钮（lemon redirect 或对应国内通道） */}
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => submit(PAY_CHANNEL)}
          disabled={busy !== null}
          className="btn-primary w-full py-3.5 text-[15px] font-semibold disabled:opacity-50"
        >
          {busy === PAY_CHANNEL
            ? c.processing
            : showTrial
              ? fmt(c.trialCtaFmt, { days: trialDays })
              : loggedIn
                ? c.subscribe
                : c.loginFirst}
        </button>

        {showTrial ? (
          <p className="text-center text-[11px] text-[color:var(--accent-strong)]">
            ✓ {fmt(c.trialNoteFmt, { days: trialDays })}
          </p>
        ) : null}

        {loggedIn && userEmail ? (
          <p className="text-center text-[11px] text-muted">
            {fmt(c.stripeEmailFmt, { email: userEmail })}
          </p>
        ) : null}
        <p className="text-center text-[11px] text-muted">{c.stripeNote}</p>

        {showAltChannels ? (
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => submit("alipay")}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded border border-[#1677ff]/60 bg-[#1677ff] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#0e5fd6] disabled:opacity-50"
            >
              {busy === "alipay" ? c.creatingOrder : c.alipay}
            </button>
            <button
              type="button"
              onClick={() => submit("wechat")}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded border border-[#09bb07]/60 bg-[#09bb07] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#08a006] disabled:opacity-50"
            >
              {busy === "wechat" ? c.creatingOrder : c.wechatPay}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}

      {pendingRedirect ? (
        <div className="mt-3 rounded border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 py-3 text-[12px]">
          <p className="font-bold text-[color:var(--accent-strong)]">
            {c.stripeOpened}
          </p>
          <p className="mt-1 text-foreground">
            {c.orderNo}<span className="mono">{pendingRedirect.outTradeNo}</span>
          </p>
          <p className="mt-1 text-muted">{c.stripeBlocked}</p>
          <a
            href={pendingRedirect.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block break-all rounded bg-[color:var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--background)] hover:bg-[color:var(--accent-strong)]"
          >
            {c.stripeManual}
          </a>
          <p className="mt-2 text-muted">
            <a
              href={`/pay/success?out_trade_no=${encodeURIComponent(pendingRedirect.outTradeNo)}`}
              className="mx-1 font-semibold text-accent-strong hover:underline"
            >
              {c.payConfirm}
            </a>
            {c.payPolling}
          </p>
        </div>
      ) : null}

      {/* 微信扫码 Dialog（只在 mock 或 wechat live 时使用） */}
      {qrDialog ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setQrDialog(null)}
        >
          <div
            className="card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="label-caps">{c.wechatPay}</span>
                <h2 className="mt-0.5 text-lg font-bold">{c.wechatTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setQrDialog(null)}
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
              <p className="mt-3 font-mono text-xl font-bold">{formatYuan(qrDialog.amount)}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {fmt(c.wechatOrderFmt, {
                  months: qrDialog.durationMonths,
                  order: qrDialog.outTradeNo,
                })}
              </p>

              {qrDialog.isMock ? (
                <a
                  href={`/pay/mock/${qrDialog.outTradeNo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 text-[11px] text-[color:var(--accent-strong)] hover:underline"
                >
                  {c.wechatMock}
                </a>
              ) : null}

              <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
                {polled === "pending" ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[color:var(--accent)]" />
                    {c.wechatPending}
                  </>
                ) : polled === "paid" ? (
                  <span className="text-[color:var(--success)]">{c.wechatPaid}</span>
                ) : (
                  <span className="text-[color:var(--danger)]">{c.wechatFailed}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
