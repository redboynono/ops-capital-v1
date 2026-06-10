"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Check, X } from "lucide-react";

/**
 * 在 /t/[symbol] 顶部一键加入"模拟盘"。
 * 流程：
 *   未登录 → 显示登录提示链接
 *   已登录 → 弹出小卡：默认 avg_cost = 当前价（fetch /api/quotes），qty 用户填
 *   成功 → 显示"已加入，前往模拟盘"
 *
 * 不重复 watchlist 的 UX：watchlist=想看，position=已买/打算建仓追踪。
 */
export function QuickAddPosition({
  symbol,
  loggedIn,
}: {
  symbol: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 打开时自动 fetch 当前价格作为默认 avg_cost
  useEffect(() => {
    if (!open || avgCost) return;
    let cancelled = false;
    setLoadingPrice(true);
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const q = data?.quotes?.[symbol];
        const c = q && Number.isFinite(q.c) ? q.c : null;
        if (c != null) setAvgCost(c.toFixed(2));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingPrice(false));
    return () => {
      cancelled = true;
    };
  }, [open, symbol, avgCost]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/me/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          qty: Number(qty),
          avgCost: Number(avgCost),
          openedAt: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <Link
        href={`/login?redirect=/t/${encodeURIComponent(symbol)}`}
        className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-[12px]"
        title="登录后可添加到模拟盘"
      >
        <Briefcase className="h-3.5 w-3.5" strokeWidth={1.8} />
        加入模拟盘
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-[12px]"
        title="加入模拟盘 · 追踪 P&L"
      >
        <Briefcase className="h-3.5 w-3.5" strokeWidth={1.8} />
        加入模拟盘
      </button>
    );
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-2 rounded border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-3 py-1.5 text-[12px] text-[color:var(--success)]">
        <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
        已加入
        <Link href="/dashboard/portfolio" className="ml-1 underline hover:opacity-80">
          前往模拟盘 →
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="inline-flex flex-wrap items-end gap-2 rounded border border-border bg-surface p-2"
    >
      <div className="flex flex-col">
        <label className="label-caps mb-0.5 text-[9px]">数量</label>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          step="any"
          min="0"
          required
          autoFocus
          placeholder="100"
          className="h-8 w-24 rounded border border-border bg-surface px-2 mono text-[12px] outline-none focus:border-accent"
        />
      </div>
      <div className="flex flex-col">
        <label className="label-caps mb-0.5 text-[9px]">
          均价 {loadingPrice ? "（取价中…）" : ""}
        </label>
        <input
          type="number"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          step="any"
          min="0"
          required
          placeholder="—"
          className="h-8 w-28 rounded border border-border bg-surface px-2 mono text-[12px] outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !qty || !avgCost}
        className="h-8 rounded-sm px-3 text-[11px] font-bold disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#0a0a0d" }}
      >
        {busy ? "…" : "保存"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setErr(null);
        }}
        className="h-8 px-1 text-muted hover:text-foreground"
        aria-label="取消"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {err ? (
        <span className="basis-full text-[10px] text-[color:var(--danger)]">⚠ {err}</span>
      ) : null}
    </form>
  );
}
