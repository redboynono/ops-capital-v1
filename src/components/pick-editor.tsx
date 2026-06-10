"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Pick } from "@/lib/picks";

type Props = {
  initial?: Partial<Pick> & { id?: string };
  mode: "new" | "edit";
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

const today = () => new Date().toISOString().slice(0, 10);

export function PickEditor({ initial, mode }: Props) {
  const router = useRouter();

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [tickerSymbol, setTickerSymbol] = useState(initial?.ticker_symbol ?? "");
  const [tickerName, setTickerName] = useState(initial?.ticker_name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [thesis, setThesis] = useState(initial?.thesis_md ?? "");
  const [catalysts, setCatalysts] = useState(initial?.catalysts_md ?? "");
  const [risks, setRisks] = useState(initial?.risks_md ?? "");
  const [valuation, setValuation] = useState(initial?.valuation_md ?? "");
  const [sellDiscipline, setSellDiscipline] = useState(initial?.sell_discipline_md ?? "");

  const [entryPrice, setEntryPrice] = useState(initial?.entry_price?.toString() ?? "");
  const [entryDate, setEntryDate] = useState(
    initial?.entry_date ? new Date(initial.entry_date).toISOString().slice(0, 10) : today(),
  );
  const [targetPrice, setTargetPrice] = useState(initial?.target_price?.toString() ?? "");
  const [stopPrice, setStopPrice] = useState(initial?.stop_price?.toString() ?? "");
  const [horizonMonths, setHorizonMonths] = useState(initial?.horizon_months?.toString() ?? "12");
  const [conviction, setConviction] = useState<Pick["conviction"]>(initial?.conviction ?? "medium");
  const [tags, setTags] = useState(initial?.tags ?? "");

  const [status, setStatus] = useState<Pick["status"]>(initial?.status ?? "open");
  const [closePrice, setClosePrice] = useState(initial?.close_price?.toString() ?? "");
  const [closeDate, setCloseDate] = useState(
    initial?.close_date ? new Date(initial.close_date).toISOString().slice(0, 10) : "",
  );
  const [closeReason, setCloseReason] = useState(initial?.close_reason ?? "");

  const [isPremium, setIsPremium] = useState<boolean>(initial?.is_premium !== 0);
  const [isPublished, setIsPublished] = useState<boolean>(initial?.is_published === 1);

  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onAiGenerate = async () => {
    setError(null);
    setMessage(null);
    const sym = tickerSymbol.trim().toUpperCase();
    if (!sym) {
      setError("请先填 Ticker（如 AMD），AI 会根据最新 factsheet + 评级一键生成草稿");
      return;
    }
    if (
      thesis.trim().length > 0 &&
      !confirm(`AI 将基于 ${sym} 的最新 factsheet + 评级生成完整草稿，覆盖当前所有内容字段。继续？`)
    ) {
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/picks/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "AI 生成失败");
      const d = data.draft as {
        title: string;
        subtitle: string | null;
        thesis_md: string;
        catalysts_md: string | null;
        risks_md: string | null;
        valuation_md: string | null;
        sell_discipline_md: string | null;
        entry_price: number;
        target_price: number | null;
        stop_price: number | null;
        horizon_months: number;
        conviction: "high" | "medium" | "low";
        tags: string | null;
        ticker_symbol: string;
        ticker_name: string;
        source_summary: string;
      };
      setTickerSymbol(d.ticker_symbol);
      if (!tickerName) setTickerName(d.ticker_name);
      setTitle(d.title);
      setSubtitle(d.subtitle ?? "");
      setThesis(d.thesis_md);
      setCatalysts(d.catalysts_md ?? "");
      setRisks(d.risks_md ?? "");
      setValuation(d.valuation_md ?? "");
      setSellDiscipline(d.sell_discipline_md ?? "");
      if (d.entry_price > 0) setEntryPrice(String(d.entry_price));
      if (d.target_price != null) setTargetPrice(String(d.target_price));
      if (d.stop_price != null) setStopPrice(String(d.stop_price));
      setHorizonMonths(String(d.horizon_months));
      setConviction(d.conviction);
      if (d.tags) setTags(d.tags);
      if (!slug) {
        setSlug(slugify(`${d.ticker_symbol.toLowerCase()}-${d.title}`));
      }
      setMessage(`AI 生成完成 · ${d.source_summary}`);
    } catch (e) {
      setError(`AI 生成失败：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setAiBusy(false);
    }
  };

  const input =
    "w-full rounded border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-soft focus:border-accent";
  const textarea = `${input} font-mono`;

  const onAutoSlug = () => {
    const sym = tickerSymbol.toLowerCase() || "pick";
    setSlug(slugify(`${sym}-${title}`));
  };

  const onSave = async () => {
    setError(null);
    setMessage(null);
    if (!slug || !tickerSymbol || !title || !thesis || !entryPrice || !entryDate) {
      setError("必填：slug / ticker / title / thesis / entry_price / entry_date");
      return;
    }
    try {
      setSaving(true);
      const body = {
        id: initial?.id,
        slug,
        ticker_symbol: tickerSymbol.toUpperCase(),
        ticker_name: tickerName || null,
        title,
        subtitle: subtitle || null,
        thesis_md: thesis,
        catalysts_md: catalysts || null,
        risks_md: risks || null,
        valuation_md: valuation || null,
        sell_discipline_md: sellDiscipline || null,
        entry_price: Number(entryPrice),
        entry_date: entryDate,
        target_price: targetPrice ? Number(targetPrice) : null,
        stop_price: stopPrice ? Number(stopPrice) : null,
        horizon_months: Number(horizonMonths) || 12,
        conviction,
        tags: tags || null,
        status,
        close_price: status !== "open" && closePrice ? Number(closePrice) : null,
        close_date: status !== "open" && closeDate ? closeDate : null,
        close_reason: status !== "open" ? closeReason || null : null,
        is_premium: isPremium,
        is_published: isPublished,
      };
      const res = await fetch("/api/admin/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "保存失败");
        return;
      }
      setMessage(`保存成功：/picks/${slug}`);
      if (mode === "new") {
        setTimeout(() => router.push(`/admin/picks/${data.id}`), 500);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!initial?.id) return;
    if (!confirm(`确认删除此 Pick？（${title}）\n此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/admin/picks/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error ?? "删除失败");
        return;
      }
      router.push("/admin/picks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-sm border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-sm border border-[color:var(--success)] bg-[color:var(--success-soft)] px-3 py-2 text-[12px] text-[color:var(--success)]">
          {message}
        </p>
      ) : null}

      {/* AI 一键生成 */}
      <section className="card flex flex-wrap items-center gap-3 border-accent/40 bg-accent/5 p-3">
        <div className="flex-1 min-w-0">
          <p className="label-caps text-accent-strong">⚡ AI 一键生成草稿</p>
          <p className="mt-0.5 text-[12px] text-muted">
            基于该标的最新 factsheet（实时报价 + 财务 + 30 天 news）+ OPS 评级 + 因子档位，AI 起草完整 Pick（含目标价、止损、退出纪律）。约需 30–60 秒。
          </p>
        </div>
        <input
          value={tickerSymbol}
          onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())}
          placeholder="Ticker"
          className="w-28 rounded border border-border bg-surface px-3 py-1.5 font-mono text-[13px] outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={onAiGenerate}
          disabled={aiBusy || saving}
          className="rounded-sm border border-accent bg-accent px-4 py-1.5 font-mono text-[12px] font-bold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {aiBusy ? "生成中…（30–60 秒）" : "⚡ AI 生成"}
        </button>
      </section>

      {/* Basic info */}
      <section className="card p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label-caps">标题</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="例如：NVDA · AI 基础设施的复利仓位" />
        </div>
        <div>
          <label className="label-caps">Ticker</label>
          <input value={tickerSymbol} onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())} className={input} placeholder="NVDA" />
        </div>
        <div>
          <label className="label-caps">Ticker 名称（冗余展示）</label>
          <input value={tickerName ?? ""} onChange={(e) => setTickerName(e.target.value)} className={input} placeholder="英伟达 NVIDIA" />
        </div>
        <div>
          <label className="label-caps">Slug（URL）</label>
          <div className="flex gap-2">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={input} placeholder="nvda-ai-infra-compounder" />
            <button type="button" onClick={onAutoSlug} className="btn-outline whitespace-nowrap px-3 py-1.5 text-[11px]">
              自动
            </button>
          </div>
        </div>
        <div>
          <label className="label-caps">副标题</label>
          <input value={subtitle ?? ""} onChange={(e) => setSubtitle(e.target.value)} className={input} placeholder="2026 Q2 · OPS 月度首选" />
        </div>
      </section>

      {/* Trade plan */}
      <section className="card p-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="label-caps">入场价 *</label>
          <input type="number" step="0.0001" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className={input} />
        </div>
        <div>
          <label className="label-caps">入场日期 *</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={input} />
        </div>
        <div>
          <label className="label-caps">目标价</label>
          <input type="number" step="0.0001" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className={input} />
        </div>
        <div>
          <label className="label-caps">止损价</label>
          <input type="number" step="0.0001" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className={input} />
        </div>
        <div>
          <label className="label-caps">持仓期限（月）</label>
          <input type="number" value={horizonMonths} onChange={(e) => setHorizonMonths(e.target.value)} className={input} />
        </div>
        <div>
          <label className="label-caps">信念等级</label>
          <select value={conviction} onChange={(e) => setConviction(e.target.value as Pick["conviction"])} className={input}>
            <option value="high">高信念</option>
            <option value="medium">中等</option>
            <option value="low">低信念</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label-caps">标签（逗号分隔）</label>
          <input value={tags ?? ""} onChange={(e) => setTags(e.target.value)} className={input} placeholder="AI, Semi, 月度首选" />
        </div>
      </section>

      {/* Status */}
      <section className="card p-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="label-caps">仓位状态</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as Pick["status"])} className={input}>
            <option value="open">开仓中</option>
            <option value="closed">已平仓（达到目标 / 主动退出）</option>
            <option value="stopped">已止损</option>
          </select>
        </div>
        {status !== "open" ? (
          <>
            <div>
              <label className="label-caps">平仓价</label>
              <input type="number" step="0.0001" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} className={input} />
            </div>
            <div>
              <label className="label-caps">平仓日期</label>
              <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className="label-caps">平仓原因</label>
              <input value={closeReason ?? ""} onChange={(e) => setCloseReason(e.target.value)} className={input} placeholder="达到目标 / 基本面破坏 / 宏观风险" />
            </div>
          </>
        ) : null}
      </section>

      {/* Content */}
      <section className="card p-4 space-y-4">
        <TextBlock label="投资逻辑（thesis）*" value={thesis} onChange={setThesis} rows={12} />
        <TextBlock label="催化剂（catalysts）" value={catalysts} onChange={setCatalysts} rows={5} />
        <TextBlock label="风险提示（risks）" value={risks} onChange={setRisks} rows={5} />
        <TextBlock label="估值分析（valuation）" value={valuation} onChange={setValuation} rows={5} />
        <TextBlock label="退出纪律（sell discipline）" value={sellDiscipline} onChange={setSellDiscipline} rows={4} />
      </section>

      {/* Publish */}
      <section className="card p-4 flex flex-wrap items-center gap-5">
        <label className="inline-flex items-center gap-2 text-[13px] text-foreground-soft">
          <input
            type="checkbox"
            checked={isPremium}
            onChange={(e) => setIsPremium(e.target.checked)}
            className="accent-[color:var(--accent)]"
          />
          Premium（付费解锁）
        </label>
        <label className="inline-flex items-center gap-2 text-[13px] text-foreground-soft">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="accent-[color:var(--accent)]"
          />
          已发布
        </label>

        <div className="ml-auto flex gap-2">
          {mode === "edit" && initial?.id ? (
            <button type="button" onClick={onDelete} className="btn-outline px-4 py-1.5 text-[13px] text-[color:var(--danger)]">
              删除
            </button>
          ) : null}
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary px-5 py-1.5 text-[13px]">
            {saving ? "保存中..." : mode === "new" ? "创建" : "保存修改"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TextBlock({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label-caps">{label}</label>
        <span className="text-[10px] text-muted">{(value ?? "").length} 字</span>
      </div>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-[12px] outline-none placeholder:text-muted-soft focus:border-accent"
      />
    </div>
  );
}
