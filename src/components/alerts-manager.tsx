"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Mail, Plus, Search, Trash2, X } from "lucide-react";

import { useDict } from "@/components/locale-provider";
import { fmt } from "@/lib/i18n/fmt";
import type { AlertRule, AlertRuleType } from "@/lib/alerts";

const RULE_UNITS: Record<AlertRuleType, string> = {
  price_above: "$",
  price_below: "$",
  move_above: "%",
  move_below: "%",
};

type Hit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  inDb: boolean;
};

export function AlertsManager({ initialAlerts }: { initialAlerts: AlertRule[] }) {
  const ui = useDict().alertsUi;
  const router = useRouter();
  const [adding, setAdding] = useState(initialAlerts.length === 0);
  const [busy, setBusy] = useState<string | null>(null);

  const ruleOptions: { value: AlertRuleType; label: string }[] = [
    { value: "price_above", label: ui.ruleTypes.price_above },
    { value: "price_below", label: ui.ruleTypes.price_below },
    { value: "move_above", label: ui.ruleTypes.move_above },
    { value: "move_below", label: ui.ruleTypes.move_below },
  ];

  function ruleLabel(type: AlertRuleType): string {
    return ui.ruleMeta[type].label;
  }

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
    if (!confirm(fmt(ui.deleteConfirmFmt, { label }))) return;
    setBusy(id);
    await fetch(`/api/me/alerts/${id}`, { method: "DELETE" });
    setBusy(null);
    refresh();
  }

  async function testSend(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/me/alerts/${id}/test`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(fmt(ui.testFailFmt, { err: data?.error ?? `HTTP ${res.status}` }));
      } else {
        alert(fmt(ui.testOkFmt, { email: data?.sentTo ?? "your email" }));
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {adding ? (
        <CreateAlertForm
          ruleOptions={ruleOptions}
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
          {ui.addBtn}
        </button>
      )}

      {initialAlerts.length === 0 ? (
        <div className="card px-4 py-8 text-center text-[13px] text-muted">{ui.empty}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 font-normal">{ui.colSymbol}</th>
                <th className="px-3 py-2 font-normal">{ui.colRule}</th>
                <th className="px-3 py-2 font-normal text-right">{ui.colThreshold}</th>
                <th className="px-3 py-2 font-normal text-right">{ui.colCooldown}</th>
                <th className="px-3 py-2 font-normal">{ui.colLastFired}</th>
                <th className="px-3 py-2 font-normal text-right">{ui.colStatus}</th>
                <th className="px-3 py-2 font-normal text-right">{ui.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {initialAlerts.map((a) => {
                const unit = RULE_UNITS[a.rule_type];
                const label = `${a.symbol} ${ruleLabel(a.rule_type)} ${a.threshold}${unit}`;
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
                    <td className="px-3 py-2 text-foreground-soft">{ruleLabel(a.rule_type)}</td>
                    <td className="px-3 py-2 mono text-right">
                      {unit === "$" ? `$${a.threshold.toFixed(2)}` : `${a.threshold.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 mono text-right text-muted">{a.cooldown_minutes}m</td>
                    <td className="px-3 py-2 mono text-[10px] text-muted">
                      {a.last_triggered_at
                        ? new Date(a.last_triggered_at).toLocaleString(undefined, { hour12: false })
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
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => testSend(a.id)}
                          disabled={busy === a.id}
                          className="text-muted hover:text-accent-strong disabled:opacity-50"
                          aria-label={ui.testAria}
                          title={ui.testTitle}
                        >
                          <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(a.id, label)}
                          disabled={busy === a.id}
                          className="text-muted hover:text-[color:var(--danger)] disabled:opacity-50"
                          aria-label={ui.deleteAria}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </button>
                      </div>
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

function CreateAlertForm({
  ruleOptions,
  onDone,
  onCancel,
}: {
  ruleOptions: { value: AlertRuleType; label: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const ui = useDict().alertsUi;
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
      setErr(e instanceof Error ? e.message : ui.fail);
    } finally {
      setBusy(false);
    }
  }

  const unit = RULE_UNITS[ruleType];

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold">{ui.formTitle}</h3>
        <button type="button" onClick={onCancel} className="text-muted hover:text-foreground">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr]">
        <div className="relative">
          <label className="label-caps mb-1 block text-[10px]">{ui.labelSymbol}</label>
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
          <label className="label-caps mb-1 block text-[10px]">{ui.labelRule}</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
            className="h-9 w-full rounded border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
          >
            {ruleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">
            {fmt(ui.labelThresholdFmt, { unit })}
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={unit === "$" ? "500" : "5"}
            step="any"
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">{ui.labelCooldown}</label>
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

      <p className="mt-2 text-[10px] text-muted">{ui.cooldownHint}</p>

      {err ? <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {err}</p> : null}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-[12px] text-muted hover:text-foreground">
          {ui.cancel}
        </button>
        <button
          type="submit"
          disabled={busy || !symbol || !threshold}
          className="h-8 rounded-sm px-3 text-[12px] font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0a0a0d" }}
        >
          {busy ? ui.saving : ui.save}
        </button>
      </div>
    </form>
  );
}
