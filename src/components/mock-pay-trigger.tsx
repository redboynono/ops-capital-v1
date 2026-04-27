"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  outTradeNo: string;
  channel: "alipay" | "wechat" | "gumroad";
  successSig: string;
  failedSig: string;
  initialStatus: "pending" | "paid" | "failed";
};

export function MockPayTrigger({
  outTradeNo,
  channel,
  successSig,
  failedSig,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "success" | "failed">(null);
  const [status, setStatus] = useState(initialStatus);
  const [err, setErr] = useState<string | null>(null);

  const trigger = async (kind: "success" | "failed") => {
    setBusy(kind);
    setErr(null);
    try {
      // Mock 模式下三种通道共用同一套 HMAC 验签流程，
      // 走 alipay 通道的 webhook handler 即可（gumroad 真实 webhook 用不同协议）
      const webhookChannel = channel === "gumroad" ? "alipay" : channel;
      const res = await fetch(`/api/pay/notify/${webhookChannel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          out_trade_no: outTradeNo,
          trade_status: kind === "success" ? "TRADE_SUCCESS" : "FAILED",
          gateway_trade_no: `MOCK-${outTradeNo}`,
          mock_signature: kind === "success" ? successSig : failedSig,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        setErr(`webhook ${res.status}: ${text.slice(0, 100)}`);
        return;
      }
      if (kind === "success") {
        window.location.href = `/pay/success?out_trade_no=${encodeURIComponent(outTradeNo)}`;
      } else {
        setStatus("failed");
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(null);
    }
  };

  if (status === "paid") {
    return (
      <p className="card mt-4 p-4 text-[13px] text-[color:var(--success)]">
        订单已支付。
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {err ? (
        <p className="rounded border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
          {err}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => trigger("success")}
          disabled={busy !== null || status !== "pending"}
          className="btn-primary flex-1 py-2.5 text-[13px]"
        >
          {busy === "success" ? "处理中..." : "✓ 模拟支付成功"}
        </button>
        <button
          type="button"
          onClick={() => trigger("failed")}
          disabled={busy !== null || status !== "pending"}
          className="btn-outline py-2.5 px-4 text-[13px] text-[color:var(--danger)]"
        >
          {busy === "failed" ? "..." : "模拟失败"}
        </button>
      </div>
    </div>
  );
}
