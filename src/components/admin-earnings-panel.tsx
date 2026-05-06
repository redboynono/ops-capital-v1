"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type EarningsAdminRow = {
  id: string;
  symbol: string;
  fiscal_year: number;
  fiscal_quarter: number;
  report_date: string;
  hour: string | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  post_id: string | null;
  post_slug: string | null;
  generation_attempts: number;
  last_error: string | null;
};

type Props = {
  rows: EarningsAdminRow[];
};

function fmtRevenue(v: number | null): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

function fmtEps(v: number | null): string {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

type StatusKind = "generated" | "pending" | "scheduled" | "failed";

function statusOf(r: EarningsAdminRow): StatusKind {
  if (r.post_id) return "generated";
  if (r.eps_actual == null) return "scheduled";
  if (r.generation_attempts >= 3) return "failed";
  return "pending";
}

const STATUS_LABEL: Record<StatusKind, { label: string; cls: string }> = {
  generated: { label: "✓ 已生成", cls: "text-[color:var(--success)]" },
  pending: { label: "⏳ 待生成", cls: "text-[color:var(--accent-strong)]" },
  scheduled: { label: "📅 已排期", cls: "text-muted" },
  failed: { label: "✕ 生成失败", cls: "text-[color:var(--danger)]" },
};

export function AdminEarningsPanel({ rows }: Props) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<{ id: string; msg: string } | null>(null);
  const [scanDays, setScanDays] = useState(3);

  const counts = {
    total: rows.length,
    generated: rows.filter((r) => r.post_id).length,
    pending: rows.filter((r) => !r.post_id && r.eps_actual != null && r.generation_attempts < 3).length,
    scheduled: rows.filter((r) => r.eps_actual == null).length,
    failed: rows.filter((r) => !r.post_id && r.eps_actual != null && r.generation_attempts >= 3).length,
  };

  const onScan = async () => {
    setScanning(true);
    setScanMsg(null);
    setScanError(null);
    try {
      const res = await fetch(`/api/cron/earnings?days=${scanDays}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setScanMsg(
        `扫描完成：Finnhub 返回 ${data.finnhub_total} 条 / 命中覆盖 ${data.matched_our_tickers} · 写入 ${data.upserted} · 生成 ${data.generated?.length ?? 0} 篇 · 失败 ${data.failures?.length ?? 0}`,
      );
      router.refresh();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setScanning(false);
    }
  };

  const onRetry = async (id: string) => {
    setRetryingId(id);
    setRetryError(null);
    try {
      const res = await fetch(`/api/admin/earnings/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRetryError({ id, msg: data?.detail ?? data?.error ?? `HTTP ${res.status}` });
        return;
      }
      router.refresh();
    } catch (e) {
      setRetryError({ id, msg: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <>
      {/* 顶部操作栏 */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">扫描窗口：</span>
            <select
              value={scanDays}
              onChange={(e) => setScanDays(Number(e.target.value))}
              disabled={scanning}
              className="rounded border border-border bg-surface px-2 py-1 font-mono text-[12px] text-foreground"
            >
              <option value={1}>过去 1 天</option>
              <option value={2}>过去 2 天</option>
              <option value={3}>过去 3 天</option>
              <option value={7}>过去 7 天</option>
              <option value={14}>过去 14 天</option>
            </select>
          </div>
          <button
            type="button"
            onClick={onScan}
            disabled={scanning}
            className="btn-primary px-4 py-1.5 text-[13px] disabled:opacity-60"
          >
            {scanning ? "扫描中..." : "立即扫描财报"}
          </button>
          <span className="flex-1" />
          <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
            <span>
              总计 <span className="font-bold text-foreground">{counts.total}</span>
            </span>
            <span>
              已生成 <span className="font-bold text-[color:var(--success)]">{counts.generated}</span>
            </span>
            <span>
              待生成 <span className="font-bold text-[color:var(--accent-strong)]">{counts.pending}</span>
            </span>
            <span>
              已排期 <span className="font-bold">{counts.scheduled}</span>
            </span>
            <span>
              失败 <span className="font-bold text-[color:var(--danger)]">{counts.failed}</span>
            </span>
          </div>
        </div>
        {scanMsg ? (
          <p className="mt-3 rounded border border-[color:var(--success)] bg-[color:var(--success-soft)] px-3 py-2 text-[12px] text-[color:var(--success)]">
            {scanMsg}
          </p>
        ) : null}
        {scanError ? (
          <p className="mt-3 rounded border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
            扫描失败：{scanError}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-muted">
          Cron 每 4 小时自动扫描（过去 2 天）。手动扫描可选更大窗口以回填历史。
        </p>
      </div>

      {/* 表格 */}
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          还没有任何财报记录。点「立即扫描财报」拉取最新数据。
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[70px_60px_90px_60px_110px_110px_80px_1fr_90px] gap-3 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span>代码</span>
            <span>季度</span>
            <span>报告日</span>
            <span>时段</span>
            <span className="text-right">EPS 实/预</span>
            <span className="text-right">营收 实/预</span>
            <span>状态</span>
            <span>文章 / 错误</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const status = statusOf(r);
              const info = STATUS_LABEL[status];
              const isRetrying = retryingId === r.id;
              const rowErr = retryError?.id === r.id ? retryError.msg : null;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[70px_60px_90px_60px_110px_110px_80px_1fr_90px] items-center gap-3 px-3 py-2 text-[12px]"
                >
                  <Link
                    href={`/t/${r.symbol}`}
                    className="font-mono font-bold text-accent-strong hover:underline"
                  >
                    {r.symbol}
                  </Link>
                  <span className="font-mono text-muted">
                    {r.fiscal_year}Q{r.fiscal_quarter}
                  </span>
                  <span className="font-mono text-muted">
                    {new Date(r.report_date).toISOString().slice(0, 10)}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{r.hour ?? "—"}</span>
                  <span className="font-mono text-right">
                    {fmtEps(r.eps_actual)} / {fmtEps(r.eps_estimate)}
                  </span>
                  <span className="font-mono text-right">
                    {fmtRevenue(r.revenue_actual)} / {fmtRevenue(r.revenue_estimate)}
                  </span>
                  <span className={`font-semibold ${info.cls}`}>{info.label}</span>
                  <span className="truncate text-foreground-soft">
                    {r.post_slug ? (
                      <Link
                        href={`/analysis/${r.post_slug}`}
                        className="text-accent-strong hover:underline"
                      >
                        /analysis/{r.post_slug}
                      </Link>
                    ) : rowErr ? (
                      <span className="text-[color:var(--danger)]">× {rowErr}</span>
                    ) : r.last_error ? (
                      <span className="text-[11px] text-[color:var(--danger)]">
                        × {r.last_error.slice(0, 120)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <span className="text-right">
                    {status === "generated" ? (
                      <button
                        type="button"
                        onClick={() => onRetry(r.id)}
                        disabled={isRetrying}
                        className="text-[11px] text-muted hover:text-accent-strong disabled:opacity-60"
                        title="重新生成（会覆盖现有文章）"
                      >
                        {isRetrying ? "生成中..." : "重新生成"}
                      </button>
                    ) : status === "scheduled" ? (
                      <span className="text-[11px] text-muted">未释放</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRetry(r.id)}
                        disabled={isRetrying}
                        className="text-[11px] font-semibold text-[color:var(--accent-strong)] hover:underline disabled:opacity-60"
                      >
                        {isRetrying ? "生成中..." : status === "failed" ? "重试" : "立即生成"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
