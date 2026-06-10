"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";

import type { ConvictionList, ConvictionPick } from "@/lib/conviction";

type Bundle = { list: ConvictionList; picks: ConvictionPick[] };

export function ConvictionAdmin({ initialLists }: { initialLists: Bundle[] }) {
  const router = useRouter();
  const [openListId, setOpenListId] = useState<string | null>(initialLists[0]?.list.id ?? null);
  const [showCreate, setShowCreate] = useState(initialLists.length === 0);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Create new list */}
      {showCreate ? (
        <CreateListForm
          onDone={() => {
            setShowCreate(false);
            refresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-foreground-soft px-3 py-1.5 mono text-[12px] text-foreground-soft hover:border-accent hover:text-accent-strong"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          新建榜单
        </button>
      )}

      {initialLists.length === 0 ? (
        <p className="text-[13px] text-muted">暂无榜单。</p>
      ) : (
        initialLists.map((b) => (
          <ListPanel
            key={b.list.id}
            bundle={b}
            open={openListId === b.list.id}
            onToggle={() => setOpenListId(openListId === b.list.id ? null : b.list.id)}
            onChange={refresh}
          />
        ))
      )}
    </div>
  );
}

// ---------------------- create list ----------------------

function CreateListForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [periodLabel, setPeriodLabel] = useState("");
  const [publishDate, setPublishDate] = useState(new Date().toISOString().slice(0, 10));
  const [thesis, setThesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/conviction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodLabel, publishDate, thesis: thesis || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold">新建榜单</h3>
        <button type="button" onClick={onCancel} className="text-muted hover:text-foreground">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label-caps mb-1 block text-[10px]">期次标签 *（如「2026年5月」）</label>
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="label-caps mb-1 block text-[10px]">建仓日期 *</label>
          <input
            type="date"
            value={publishDate}
            onChange={(e) => setPublishDate(e.target.value)}
            required
            className="h-9 w-full rounded border border-border bg-surface px-2 mono text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label-caps mb-1 block text-[10px]">榜单逻辑（可多行）</label>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-accent"
            placeholder="本期主题、宏观背景、选股标准…"
          />
        </div>
      </div>
      {err ? <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {err}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-[12px] text-muted hover:text-foreground">
          取消
        </button>
        <button
          type="submit"
          disabled={busy || !periodLabel}
          className="h-8 rounded-sm px-3 text-[12px] font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0a0a0d" }}
        >
          {busy ? "创建中…" : "创建"}
        </button>
      </div>
    </form>
  );
}

// ---------------------- list panel ----------------------

function ListPanel({
  bundle,
  open,
  onToggle,
  onChange,
}: {
  bundle: Bundle;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const { list, picks } = bundle;
  const [busy, setBusy] = useState(false);

  async function close() {
    if (!confirm(`关闭榜单「${list.period_label}」？此后净值停止更新。`)) return;
    setBusy(true);
    await fetch(`/api/admin/conviction/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endDate: new Date().toISOString().slice(0, 10),
        isActive: false,
      }),
    });
    onChange();
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`彻底删除榜单「${list.period_label}」？所有 picks 一并消失。`)) return;
    setBusy(true);
    await fetch(`/api/admin/conviction/${list.id}`, { method: "DELETE" });
    onChange();
    setBusy(false);
  }

  const active = list.is_active === 1 && !list.end_date;

  return (
    <section className="card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-muted"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-bold text-foreground">{list.period_label}</span>
          <span className="mono text-[10px] text-muted">{list.publish_date}</span>
          {active ? <span className="text-[10px] text-accent-strong">● ACTIVE</span> : <span className="text-[10px] text-muted">CLOSED</span>}
          <span className="mono text-[10px] text-muted">{picks.length} picks</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/conviction/${list.id}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-muted hover:text-accent-strong"
          >
            查看 →
          </Link>
        </div>
      </button>

      {open ? (
        <div className="border-t border-border px-4 py-3">
          {/* picks table */}
          {picks.length > 0 ? (
            <table className="mb-3 w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="py-1 font-normal">代码</th>
                  <th className="py-1 font-normal text-right">权重</th>
                  <th className="py-1 font-normal text-right">建仓价</th>
                  <th className="py-1 font-normal">逻辑</th>
                  <th className="py-1 font-normal text-right"></th>
                </tr>
              </thead>
              <tbody>
                {picks.map((p) => (
                  <PickRow key={p.id} pick={p} listId={list.id} onChange={onChange} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mb-3 text-[12px] text-muted">尚未添加 picks。</p>
          )}

          <AddPickForm listId={list.id} onChange={onChange} />

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
            {active ? (
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="text-[11px] text-muted hover:text-foreground"
              >
                关闭榜单
              </button>
            ) : null}
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-[11px] text-[color:var(--danger)] hover:opacity-80"
            >
              删除
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PickRow({
  pick,
  listId,
  onChange,
}: {
  pick: ConvictionPick;
  listId: string;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm(`删除 ${pick.symbol}？`)) return;
    setBusy(true);
    await fetch(`/api/admin/conviction/${listId}/picks/${pick.id}`, { method: "DELETE" });
    onChange();
    setBusy(false);
  }
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-1.5 mono font-bold text-accent-strong">{pick.symbol}</td>
      <td className="py-1.5 mono text-right">{(pick.weight * 100).toFixed(1)}%</td>
      <td className="py-1.5 mono text-right">${pick.entry_price.toFixed(2)}</td>
      <td className="py-1.5 text-foreground-soft">
        <span className="line-clamp-1">{pick.thesis ?? "—"}</span>
      </td>
      <td className="py-1.5 text-right">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="text-muted hover:text-[color:var(--danger)]"
          aria-label="删除"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </td>
    </tr>
  );
}

function AddPickForm({ listId, onChange }: { listId: string; onChange: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [weight, setWeight] = useState("0.10");
  const [thesis, setThesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/conviction/${listId}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          entryPrice: Number(entryPrice),
          weight: Number(weight),
          thesis: thesis || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? "失败");
      }
      setSymbol("");
      setEntryPrice("");
      setThesis("");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded border border-dashed border-border p-2">
      <div className="grid gap-2 md:grid-cols-[120px_120px_80px_1fr_80px]">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="代码"
          required
          className="h-8 rounded border border-border bg-surface px-2 mono text-[12px] outline-none focus:border-accent"
        />
        <input
          type="number"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="建仓价"
          step="any"
          min="0"
          required
          className="h-8 rounded border border-border bg-surface px-2 mono text-[12px] outline-none focus:border-accent"
        />
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="权重"
          step="0.01"
          min="0"
          max="1"
          required
          className="h-8 rounded border border-border bg-surface px-2 mono text-[12px] outline-none focus:border-accent"
        />
        <input
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="逻辑（可选）"
          className="h-8 rounded border border-border bg-surface px-2 text-[12px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !symbol || !entryPrice}
          className="h-8 rounded-sm text-[11px] font-bold disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#0a0a0d" }}
        >
          {busy ? "..." : "+ 添加"}
        </button>
      </div>
      {err ? <p className="mt-1 text-[10px] text-[color:var(--danger)]">⚠ {err}</p> : null}
    </form>
  );
}
