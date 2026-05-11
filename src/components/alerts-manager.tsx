"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Plus, Search, Trash2, X } from "lucide-react";

import type { AlertRule, AlertRuleType } from "@/lib/alerts";

// 注意：本组件为 client，不能从 @/lib/alerts 导入 runtime 符号（含 mysql 依赖）。
// 仅做类型导入；下面就地复制纯 UI 文案表。
const RULE_LABELS: Record<AlertRuleType, { zh: string; verb: string; unit: string }> = {
  price_above: { zh: "现价 ≥", verb: "突破上方", unit: "$" },
  price_below: { zh: "现价 ≤", verb: "跌破下方", unit: "$" },
  move_above: { zh: "今日涨幅 ≥", verb: "今日大涨", unit: "%" },
  move_below: { zh: "今日跌幅 ≥", verb: "今日大跌", unit: "%" },
};

type Hit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  inDb: boolean;
};

const RULE_OPTIONS: { value: AlertRuleType; label: string }[] = [
  { value: "price_above", label: "现价突破上方" },
  { value: "price_below", label: "现价跌破下方" },
  { value: "move_above", label: "今日涨幅 ≥" },
  { value: "move_below", label: "今日跌幅 ≥" },
];

export function AlertsManager({ initialAlerts }: { initialAlerts: AlertRule[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(initialAlerts.length === 0);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function toggle(id: string, isActive: boolean) {
    setBusy(id);
    await fetch(`/api/me/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setBusy(null);
    refresh();
  }

  async function remove(id: string, label: string) {
    if (!confirm(`删除提醒：${label}？`)) return;
    setBusy(id);
    await fetch(`/api/me/alerts/${id}`, { method: "DELETE" });
    setBusy(null);
    refresh();
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <CreateAlertForm
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-foreground-soft px-3 py-1.5 mono text-[12px] text-foreground-soft hover:border-accent hover:text-accent-strong"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          新增提醒
        </button>
      )}

      {initialAlerts.length === 0 ? (
        <div className="card px-4 py-8 text-center text-[13px] text-muted">
          还没有提醒规则。新增第一条后，每 15 分钟检查一次（仅美股交易时段）。
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-normal">代码</th>
                <th className="px-3 py-2 font-normal">规则</th>
                <th className="px-3 py-2 font-normal text-right">阈值</th>
                <th className="px-3 py-2 font-normal text-right">冷却</th>
                <th className="px-3 py-2 font-normal">最近触发</th>
                <th className="px-3 py-2 font-normal text-right">状态</th>
                <th className="px-3 py-2 font-normal text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {initialAlerts.map((a) => {
                const meta = RULE_LABELS[a.rule_type];
                const label = `${a.symbol} ${meta.zh} ${a.threshold}${meta.unit}`;
                const active = a.is_active === 1;
                return (
                  <tr key={a.id} className="border-b border-border last:border-b-0 hover:bg-surface-muted">
                    <td className="px-3 py-2">
                      <Link
                        href={`/t/${encodeURIComponent(a.symbol)}`}
                        className="mono font-bold text-accent-strong hover:underline"
                      >
                        {a.symbol}
                      </Link>
                      {a.ticker_name ? (
                        <p className="text-[10px] text-muted line-clamp-1">{a.ticker_name}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-foreground-soft">{meta.zh}</td>
                    <td className="px-3 py-2 mono text-right">
                      {meta.unit === "$" ? `$${a.threshold.toFixed(2)}` : `${a.threshold.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 mono text-right text-muted">{a.cooldown_minutes}m</td>
                    <td className="px-3 py-2 mono text-[10px] text-muted">
                      {a.last_triggered_at
                        ? new Date(a.last_triggered_at).toLocaleString("zh-CN", { hour12: false })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggle(a.id, !active)}
                        disabled={busy === a.id}
                        className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 mono text-[10px] ${
                          active
                            ? "bg-accent/15 text-accent-strong"
                            : "border border-border text-muted"
                        } disabled:opacity-50`}
                      >
                        {active ? (
                          <>
                            <Bell className="h-3 w-3" strokeWidth={2} />
                            ACTIVE
                          </>
                        ) : (
                          <>
                            <BellOff className="h-3 w-3" strokeWidth={2} />
                            PAUSED
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(a.id, label)}
                        disabled={busy === a.id}
                        className="text-muted hover:text-[color:var(--danger)] disabled:opacity-50"
                        aria-label="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateAlertForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [ruleType, setRuleType] = useState<AlertRuleType>("price_above");
  const [threshold, setThreshold] = useState("");
  const [cooldown, setCooldown] = useState("60");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = symbol.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    ctrlRef.current?.abort();
    ctrlRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickers/lookup?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { hits: Hit[] };
          setHits(data.hits ?? []);
        }
      } catch {
        /* aborted */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [symbol]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/me/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          ruleType,
          threshold: Number(threshold),
          cooldownMinutes: Number(cooldown),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? `HTTP ${res.status}`);
      }
      setSymbol("");
      setThreshold("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
    }
  }

  const meta = RULE_LABELS[ruleType];

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold">新增提醒</h3>
        <button type="button" onClick={onCancel} className="text-muted hover:text-foreground">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr]">
        {/* symbol with autocomplete */}
        <div className="relative">
          <label className="label-caps mb-1 block text-[10px]">代码 *</label>
          <div className="flex h-9 items-center gap-1.5 rounded border border-border bg-surface px-2 focus-within:border-accent">
            <Search className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="flex-1 bg-transparent mono text-[13px] outline-none"
              required
            />
          </div>
          {hits.length > 0 ? (
            <ul className="absolute left-0 right-0 top-[68px] z-10 max-h-56 overflow-y-auto rounded border border-border bg-surface shadow-lg">
              {hits.map((h) => (
                <li key={h.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      setSymbol(h.symbol);
                      setHits([]);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-surface-muted"
                  >
                    <span className="mono font-bold text-accent-strong">{h.displaySymbol}</span>
                    <span className="flex-1 truncate text-foreground-soft">{h.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">规则类型 *</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
            className="h-9 w-full rounded border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
          >
            {RULE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">阈值 ({meta.unit}) *</label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={meta.unit === "$" ? "500" : "5"}
            step="any"
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">冷却（分钟）</label>
          <input
            type="number"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            min="15"
            max="1440"
            step="15"
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted">
        触发后会发邮件并进入冷却期；冷却结束后再次满足条件才会重发。
      </p>

      {err ? <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {err}</p> : null}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-[12px] text-muted hover:text-foreground">
          取消
        </button>
        <button
          type="submit"
          disabled={busy || !symbol || !threshold}
          className="h-8 rounded-sm px-3 text-[12px] font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0a0a0d" }}
        >
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
