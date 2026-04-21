"use client";

import { useCallback, useEffect, useState } from "react";

type Verdict = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" | "";
type Grade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F"
  | "";

const VERDICT_OPTS: Verdict[] = ["", "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
const GRADE_OPTS: Grade[] = [
  "", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
];
const CORE_FACTORS = ["VALUATION", "GROWTH", "PROFITABILITY", "MOMENTUM", "REVISIONS"] as const;
const DIVIDEND_FACTORS = ["DIV_SAFETY", "DIV_GROWTH", "DIV_YIELD", "DIV_CONSISTENCY"] as const;
type FactorKey = (typeof CORE_FACTORS)[number] | (typeof DIVIDEND_FACTORS)[number];

const FACTOR_LABELS: Record<FactorKey, string> = {
  VALUATION: "Valuation 估值",
  GROWTH: "Growth 成长",
  PROFITABILITY: "Profitability 盈利",
  MOMENTUM: "Momentum 动量",
  REVISIONS: "Revisions 预期修正",
  DIV_SAFETY: "Safety 分红安全",
  DIV_GROWTH: "Growth 分红增长",
  DIV_YIELD: "Yield 分红收益",
  DIV_CONSISTENCY: "Consistency 分红连续性",
};

type FactorTriple = { now: Grade; m3: Grade; m6: Grade };

type FormState = {
  ops_verdict: Verdict;
  ops_score: string;
  ops_target_price: string;
  street_verdict: Verdict;
  street_score: string;
  street_target_price: string;
  street_analyst_count: string;
  rank_overall: string;
  rank_overall_total: string;
  rank_sector: string;
  rank_sector_total: string;
  rank_industry: string;
  rank_industry_total: string;
  industry: string;
  has_dividend: boolean;
  notes: string;
  factors: Record<FactorKey, FactorTriple>;
};

function emptyFactors(): Record<FactorKey, FactorTriple> {
  const out = {} as Record<FactorKey, FactorTriple>;
  for (const f of [...CORE_FACTORS, ...DIVIDEND_FACTORS]) {
    out[f] = { now: "", m3: "", m6: "" };
  }
  return out;
}

function emptyState(defaultIndustry: string): FormState {
  return {
    ops_verdict: "",
    ops_score: "",
    ops_target_price: "",
    street_verdict: "",
    street_score: "",
    street_target_price: "",
    street_analyst_count: "",
    rank_overall: "",
    rank_overall_total: "",
    rank_sector: "",
    rank_sector_total: "",
    rank_industry: "",
    rank_industry_total: "",
    industry: defaultIndustry,
    has_dividend: false,
    notes: "",
    factors: emptyFactors(),
  };
}

export function RatingEditor({ symbol, defaultIndustry }: { symbol: string; defaultIndustry: string }) {
  const [state, setState] = useState<FormState>(() => emptyState(defaultIndustry));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");

  const flash = (text: string, tone: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgTone(tone);
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ratings/${symbol}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const r = data.rating as Record<string, unknown> | null;
      const factors = data.factors as Record<FactorKey, { now: Grade | null; m3: Grade | null; m6: Grade | null }>;

      setState({
        ops_verdict: (r?.ops_verdict as Verdict) ?? "",
        ops_score: r?.ops_score == null ? "" : String(r.ops_score),
        ops_target_price: r?.ops_target_price == null ? "" : String(r.ops_target_price),
        street_verdict: (r?.street_verdict as Verdict) ?? "",
        street_score: r?.street_score == null ? "" : String(r.street_score),
        street_target_price: r?.street_target_price == null ? "" : String(r.street_target_price),
        street_analyst_count: r?.street_analyst_count == null ? "" : String(r.street_analyst_count),
        rank_overall: r?.rank_overall == null ? "" : String(r.rank_overall),
        rank_overall_total: r?.rank_overall_total == null ? "" : String(r.rank_overall_total),
        rank_sector: r?.rank_sector == null ? "" : String(r.rank_sector),
        rank_sector_total: r?.rank_sector_total == null ? "" : String(r.rank_sector_total),
        rank_industry: r?.rank_industry == null ? "" : String(r.rank_industry),
        rank_industry_total: r?.rank_industry_total == null ? "" : String(r.rank_industry_total),
        industry: (r?.industry as string) ?? defaultIndustry,
        has_dividend: !!r?.has_dividend,
        notes: (r?.notes as string) ?? "",
        factors: {
          ...emptyFactors(),
          ...Object.fromEntries(
            Object.entries(factors ?? {}).map(([k, v]) => [
              k,
              { now: (v?.now ?? "") as Grade, m3: (v?.m3 ?? "") as Grade, m6: (v?.m6 ?? "") as Grade },
            ]),
          ),
        } as Record<FactorKey, FactorTriple>,
      });
    } catch (e) {
      flash(`加载失败：${e instanceof Error ? e.message : "未知错误"}`, "err");
    } finally {
      setLoading(false);
    }
  }, [symbol, defaultIndustry]);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [key]: v }));

  const updateFactor = (f: FactorKey, col: keyof FactorTriple, v: Grade) =>
    setState((s) => ({ ...s, factors: { ...s.factors, [f]: { ...s.factors[f], [col]: v } } }));

  const onAiGenerate = async () => {
    if (!confirm(`用 MiniMax 自动生成 ${symbol} 的评级？将覆盖当前字段。`)) return;
    setAiBusy(true);
    try {
      const res = await fetch(`/api/admin/ratings/${symbol}/ai-generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "AI 生成失败");
      flash(`AI 生成完成 · Quant=${data.quant_score?.toFixed?.(2) ?? "—"}`);
      await load();
    } catch (e) {
      flash(`AI 生成失败：${e instanceof Error ? e.message : "未知错误"}`, "err");
    } finally {
      setAiBusy(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ops_verdict: state.ops_verdict || null,
        ops_score: state.ops_score === "" ? null : Number(state.ops_score),
        ops_target_price: state.ops_target_price === "" ? null : Number(state.ops_target_price),
        street_verdict: state.street_verdict || null,
        street_score: state.street_score === "" ? null : Number(state.street_score),
        street_target_price: state.street_target_price === "" ? null : Number(state.street_target_price),
        street_analyst_count: state.street_analyst_count === "" ? null : Number(state.street_analyst_count),
        rank_overall: state.rank_overall === "" ? null : Number(state.rank_overall),
        rank_overall_total: state.rank_overall_total === "" ? null : Number(state.rank_overall_total),
        rank_sector: state.rank_sector === "" ? null : Number(state.rank_sector),
        rank_sector_total: state.rank_sector_total === "" ? null : Number(state.rank_sector_total),
        rank_industry: state.rank_industry === "" ? null : Number(state.rank_industry),
        rank_industry_total: state.rank_industry_total === "" ? null : Number(state.rank_industry_total),
        industry: state.industry || null,
        has_dividend: state.has_dividend,
        notes: state.notes || null,
        source: "MANUAL" as const,
        factors: Object.fromEntries(
          Object.entries(state.factors).map(([k, v]) => [
            k, { now: v.now || null, m3: v.m3 || null, m6: v.m6 || null },
          ]),
        ),
      };
      const res = await fetch(`/api/admin/ratings/${symbol}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存失败");
      flash(`保存成功 · Quant=${data.rating?.quant_score ?? "—"}`);
    } catch (e) {
      flash(`保存失败：${e instanceof Error ? e.message : "未知错误"}`, "err");
    } finally {
      setSaving(false);
    }
  };

  const renderFactorRow = (f: FactorKey) => {
    const v = state.factors[f];
    return (
      <div key={f} className="grid grid-cols-[1fr_120px_120px_120px] items-center gap-2 py-1.5">
        <span className="text-[12px] text-foreground-soft">{FACTOR_LABELS[f]}</span>
        {(["now", "m3", "m6"] as const).map((col) => (
          <select
            key={col}
            value={v[col]}
            onChange={(e) => updateFactor(f, col, e.target.value as Grade)}
            className="input-style"
          >
            {GRADE_OPTS.map((g) => (
              <option key={g} value={g}>{g || "—"}</option>
            ))}
          </select>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="card p-8 text-center text-[13px] text-muted">加载中…</div>;
  }

  return (
    <div className="space-y-5">
      {msg ? (
        <div
          className="rounded-sm border px-3 py-2 text-[12px] font-mono"
          style={{
            background: msgTone === "ok" ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
            borderColor: msgTone === "ok" ? "rgba(22,163,74,0.5)" : "rgba(220,38,38,0.5)",
            color: msgTone === "ok" ? "#4ade80" : "#fca5a5",
          }}
        >{msg}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onAiGenerate}
          disabled={aiBusy || saving}
          className="rounded-sm border border-accent/50 bg-accent/15 px-4 py-1.5 text-[12px] font-mono font-bold text-accent-strong hover:bg-accent/25 disabled:opacity-50"
        >{aiBusy ? "AI 生成中…（约 15-30 秒）" : "⚡ AI 一键生成评级"}</button>
        <button
          onClick={onSave}
          disabled={aiBusy || saving}
          className="rounded-sm border border-border bg-foreground/10 px-4 py-1.5 text-[12px] font-mono font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
        >{saving ? "保存中…" : "💾 保存"}</button>
        <button
          onClick={load}
          disabled={aiBusy || saving}
          className="rounded-sm border border-border px-4 py-1.5 text-[12px] font-mono text-muted hover:text-foreground disabled:opacity-50"
        >↻ 重载</button>
      </div>

      {/* Ratings Summary */}
      <section className="card p-4">
        <p className="label-caps">Ratings Summary</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="OPS Desk Verdict">
            <select value={state.ops_verdict} onChange={(e) => update("ops_verdict", e.target.value as Verdict)} className="input-style">
              {VERDICT_OPTS.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
            </select>
          </Field>
          <Field label="OPS Desk Score (1.00–5.00)">
            <input type="number" step="0.01" min="1" max="5" value={state.ops_score}
              onChange={(e) => update("ops_score", e.target.value)} className="input-style" />
          </Field>
          <Field label="OPS 目标价 ($)">
            <input type="number" step="0.01" value={state.ops_target_price}
              onChange={(e) => update("ops_target_price", e.target.value)} className="input-style" />
          </Field>
          <Field label="Street Verdict">
            <select value={state.street_verdict} onChange={(e) => update("street_verdict", e.target.value as Verdict)} className="input-style">
              {VERDICT_OPTS.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
            </select>
          </Field>
          <Field label="Street Score (1.00–5.00)">
            <input type="number" step="0.01" min="1" max="5" value={state.street_score}
              onChange={(e) => update("street_score", e.target.value)} className="input-style" />
          </Field>
          <Field label="Street 目标价 ($)">
            <input type="number" step="0.01" value={state.street_target_price}
              onChange={(e) => update("street_target_price", e.target.value)} className="input-style" />
          </Field>
          <Field label="Street 分析师数">
            <input type="number" value={state.street_analyst_count}
              onChange={(e) => update("street_analyst_count", e.target.value)} className="input-style" />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-muted">Quant Score 会根据下方 Factor Grades 自动加权计算。</p>
      </section>

      {/* Factor Grades */}
      <section className="card p-4">
        <p className="label-caps">Factor Grades</p>
        <div className="mt-3 grid grid-cols-[1fr_120px_120px_120px] items-center gap-2 text-[11px] font-mono text-muted">
          <span></span>
          <span className="text-center">Now</span>
          <span className="text-center">3M ago</span>
          <span className="text-center">6M ago</span>
        </div>
        {CORE_FACTORS.map(renderFactorRow)}

        <div className="mt-4 flex items-center gap-2">
          <input id="has_div" type="checkbox" checked={state.has_dividend}
            onChange={(e) => update("has_dividend", e.target.checked)} />
          <label htmlFor="has_div" className="text-[12px] text-foreground-soft">有分红 · 显示 Dividend Grades</label>
        </div>

        {state.has_dividend ? (
          <>
            <div className="mt-3 border-t border-border pt-3">
              <p className="label-caps">Dividend Grades</p>
            </div>
            {DIVIDEND_FACTORS.map(renderFactorRow)}
          </>
        ) : null}
      </section>

      {/* Quant Ranking */}
      <section className="card p-4">
        <p className="label-caps">Quant Ranking</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="行业 Industry">
            <input type="text" value={state.industry}
              onChange={(e) => update("industry", e.target.value)} className="input-style" />
          </Field>
          <div />
          <Field label="全市场排名 (n / total)">
            <div className="flex gap-2">
              <input type="number" value={state.rank_overall} placeholder="n"
                onChange={(e) => update("rank_overall", e.target.value)} className="input-style flex-1" />
              <input type="number" value={state.rank_overall_total} placeholder="total"
                onChange={(e) => update("rank_overall_total", e.target.value)} className="input-style flex-1" />
            </div>
          </Field>
          <Field label="板块排名 (n / total)">
            <div className="flex gap-2">
              <input type="number" value={state.rank_sector} placeholder="n"
                onChange={(e) => update("rank_sector", e.target.value)} className="input-style flex-1" />
              <input type="number" value={state.rank_sector_total} placeholder="total"
                onChange={(e) => update("rank_sector_total", e.target.value)} className="input-style flex-1" />
            </div>
          </Field>
          <Field label="行业排名 (n / total)">
            <div className="flex gap-2">
              <input type="number" value={state.rank_industry} placeholder="n"
                onChange={(e) => update("rank_industry", e.target.value)} className="input-style flex-1" />
              <input type="number" value={state.rank_industry_total} placeholder="total"
                onChange={(e) => update("rank_industry_total", e.target.value)} className="input-style flex-1" />
            </div>
          </Field>
        </div>
      </section>

      {/* Notes */}
      <section className="card p-4">
        <p className="label-caps">Notes (一句话要点 &lt;= 60 字)</p>
        <textarea
          value={state.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          className="input-style mt-2 w-full resize-y"
        />
      </section>

      <div className="flex justify-end gap-2 pb-6">
        <button
          onClick={onSave}
          disabled={aiBusy || saving}
          className="rounded-sm border border-accent bg-accent/90 px-6 py-2 text-[13px] font-mono font-bold text-black hover:bg-accent disabled:opacity-50"
        >{saving ? "保存中…" : "保存评级"}</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
