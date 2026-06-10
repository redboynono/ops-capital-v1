"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Plus, Search, Trash2, X, Check, Pencil } from "lucide-react";

import type { EnrichedPosition } from "@/lib/portfolio";

type Hit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  inDb: boolean;
};

export function AddPositionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // 实时 ticker 搜索（复用 /api/tickers/lookup）
  useEffect(() => {
    if (!open) return;
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
  }, [symbol, open]);

  function reset() {
    setSymbol("");
    setQty("");
    setAvgCost("");
    setOpenedAt("");
    setNotes("");
    setHits([]);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/me/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          qty: Number(qty),
          avgCost: Number(avgCost),
          openedAt: openedAt || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-dashed border-foreground-soft px-3 py-1.5 mono text-[12px] text-foreground-soft hover:border-accent hover:text-accent-strong"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        添加持仓
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-foreground">添加持仓</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* symbol with autocomplete */}
        <div className="md:col-span-2">
          <label className="label-caps mb-1 block text-[10px]">代码 *</label>
          <div className="relative">
            <div className="flex h-9 items-center gap-1.5 rounded border border-border bg-surface px-2 focus-within:border-accent">
              <Search className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="NVDA / 0700.HK / BINANCE:BTCUSDT"
                className="flex-1 bg-transparent mono text-[13px] outline-none"
                autoFocus
              />
            </div>
            {hits.length > 0 ? (
              <ul className="absolute left-0 right-0 top-10 z-10 max-h-56 overflow-y-auto rounded border border-border bg-surface shadow-lg">
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
                      {h.inDb ? <span className="text-[10px] text-muted">已收录</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">数量 *</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="100"
            step="any"
            min="0"
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">建仓均价 *</label>
          <input
            type="number"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            placeholder="125.50"
            step="any"
            min="0"
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">建仓日期</label>
          <input
            type="date"
            value={openedAt}
            onChange={(e) => setOpenedAt(e.target.value)}
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="label-caps mb-1 block text-[10px]">备注</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="可选"
            className="h-9 w-full rounded border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {error}</p> : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-[12px] text-muted hover:text-foreground"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading || !symbol || !qty || !avgCost}
          className="inline-flex h-8 items-center gap-1 rounded-sm px-3 text-[12px] font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0a0a0d" }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
          {loading ? "保存中…" : "保存"}
        </button>
      </div>

      <p className="mt-2 text-[10px] text-muted">
        同一 ticker 重复添加会覆盖已有持仓的数量与均价。如要分批建仓请自行加权计算后填写。
      </p>
    </form>
  );
}

export function PositionRowActions({ position }: { position: EnrichedPosition }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(position.qty));
  const [avgCost, setAvgCost] = useState(String(position.avg_cost));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/me/positions/${position.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: Number(qty), avgCost: Number(avgCost) }),
      });
      if (!res.ok) throw new Error("update failed");
      setEditing(false);
      router.refresh();
    } catch {
      /* swallow */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm(`确认删除 ${position.symbol} 持仓？`)) return;
    setBusy(true);
    try {
      await fetch(`/api/me/positions/${position.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          step="any"
          min="0"
          className="h-7 w-20 rounded border border-border bg-surface px-1.5 mono text-[11px] outline-none focus:border-accent"
          placeholder="数量"
        />
        <input
          type="number"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          step="any"
          min="0"
          className="h-7 w-20 rounded border border-border bg-surface px-1.5 mono text-[11px] outline-none focus:border-accent"
          placeholder="均价"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="text-[color:var(--success)] hover:opacity-80 disabled:opacity-50"
          aria-label="保存"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setQty(String(position.qty));
            setAvgCost(String(position.avg_cost));
          }}
          className="text-muted hover:text-foreground"
          aria-label="取消"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-accent-strong"
        aria-label={`编辑 ${position.symbol}`}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-muted hover:text-[color:var(--danger)] disabled:opacity-50"
        aria-label={`删除 ${position.symbol}`}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
