"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, ChevronDown, ChevronUp, Filter, RotateCcw, Save, Trash2 } from "lucide-react";

import type { ScreenerRow } from "@/lib/screener";
import type { FactorKey, Grade, Verdict } from "@/lib/ratings";

// 注意：本组件不能从 @/lib/ratings 导入运行时符号（含 mysql 依赖会被打进 client bundle）。
// 仅用 type 导入；下面这两个常量/函数本来在 ratings.ts，这里就地复制纯逻辑版本。
const CORE_FACTORS = ["VALUATION", "GROWTH", "PROFITABILITY", "MOMENTUM", "REVISIONS"] as const;

const GRADE_TO_NUM: Record<Grade, number> = {
  "A+": 4.3, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F":  0.0,
};
function gradeToGpa(g: Grade | null | undefined): number | null {
  if (!g) return null;
  return GRADE_TO_NUM[g] ?? null;
}

type Props = {
  rows: ScreenerRow[];
};

const EXCHANGES: { value: string; label: string }[] = [
  { value: "NASDAQ", label: "美股·NASDAQ" },
  { value: "NYSE", label: "美股·NYSE" },
  { value: "HKEX", label: "港股·HKEX" },
  { value: "CRYPTO", label: "加密" },
  { value: "OTHER", label: "其他" },
];

const VERDICTS: { value: Verdict; label: string; bg: string }[] = [
  { value: "STRONG_BUY", label: "强买", bg: "#166534" },
  { value: "BUY", label: "买入", bg: "#15803d" },
  { value: "HOLD", label: "持有", bg: "#ca8a04" },
  { value: "SELL", label: "卖出", bg: "#dc2626" },
  { value: "STRONG_SELL", label: "强卖", bg: "#991b1b" },
];

const FACTOR_LABELS: Record<(typeof CORE_FACTORS)[number], string> = {
  VALUATION: "估值",
  GROWTH: "成长",
  PROFITABILITY: "盈利",
  MOMENTUM: "动能",
  REVISIONS: "上调",
};

// 评级阈值选项：UI 用 "≥ A-" 这样的语义
const GRADE_THRESHOLDS: { value: number; label: string }[] = [
  { value: 0, label: "不限" },
  { value: 4.0, label: "≥ A" },
  { value: 3.7, label: "≥ A-" },
  { value: 3.3, label: "≥ B+" },
  { value: 3.0, label: "≥ B" },
  { value: 2.7, label: "≥ B-" },
  { value: 2.0, label: "≥ C" },
];

type SortKey =
  | "quant_score"
  | "rank_overall"
  | "symbol"
  | "VALUATION"
  | "GROWTH"
  | "PROFITABILITY"
  | "MOMENTUM"
  | "REVISIONS";

type SortDir = "asc" | "desc";

// 一份预设 = 一份完整的筛选 + 排序状态
type Preset = {
  name: string;
  exchanges: string[];
  verdicts: Verdict[];
  sectors: string[];
  factorMin: Record<(typeof CORE_FACTORS)[number], number>;
  minQuant: number;
  hasDividend: "any" | "yes" | "no";
  sortKey: SortKey;
  sortDir: SortDir;
};

const EMPTY_FACTOR: Preset["factorMin"] = {
  VALUATION: 0, GROWTH: 0, PROFITABILITY: 0, MOMENTUM: 0, REVISIONS: 0,
};

// 内置精选预设（不可删除）
const BUILTIN_PRESETS: Preset[] = [
  {
    name: "🌱 高成长强买",
    exchanges: [], verdicts: ["STRONG_BUY", "BUY"], sectors: [],
    factorMin: { ...EMPTY_FACTOR, GROWTH: 3.7 },
    minQuant: 3.5, hasDividend: "any",
    sortKey: "quant_score", sortDir: "desc",
  },
  {
    name: "💰 高股息 A 级盈利",
    exchanges: [], verdicts: [], sectors: [],
    factorMin: { ...EMPTY_FACTOR, PROFITABILITY: 3.7 },
    minQuant: 0, hasDividend: "yes",
    sortKey: "PROFITABILITY", sortDir: "desc",
  },
  {
    name: "📉 超跌价值",
    exchanges: [], verdicts: [], sectors: [],
    factorMin: { ...EMPTY_FACTOR, VALUATION: 3.7 },
    minQuant: 0, hasDividend: "any",
    sortKey: "MOMENTUM", sortDir: "asc", // 动能差 = 跌得多
  },
  {
    name: "⭐ 全 A 标的",
    exchanges: [], verdicts: ["STRONG_BUY", "BUY"], sectors: [],
    factorMin: { VALUATION: 3.7, GROWTH: 3.7, PROFITABILITY: 3.7, MOMENTUM: 3.7, REVISIONS: 3.7 },
    minQuant: 4.0, hasDividend: "any",
    sortKey: "quant_score", sortDir: "desc",
  },
];

const PRESETS_KEY = "ops-screener-presets-v1";

function gradeColor(g: Grade | null | undefined): string {
  if (!g) return "text-muted";
  if (g.startsWith("A")) return "text-emerald-500";
  if (g.startsWith("B")) return "text-lime-500";
  if (g.startsWith("C")) return "text-amber-500";
  if (g.startsWith("D")) return "text-orange-500";
  return "text-red-500"; // F
}

function verdictBadge(v: Verdict | null) {
  if (!v) return <span className="text-muted">—</span>;
  const found = VERDICTS.find((x) => x.value === v);
  if (!found) return <span className="text-muted">{v}</span>;
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm px-2 py-0.5 mono text-[10px] font-bold tracking-wide text-white"
      style={{ background: found.bg }}
    >
      {found.label}
    </span>
  );
}

export function ScreenerBrowser({ rows }: Props) {
  const [exchanges, setExchanges] = useState<Set<string>>(new Set());
  const [verdicts, setVerdicts] = useState<Set<Verdict>>(new Set());
  const [sectors, setSectors] = useState<Set<string>>(new Set());
  const [factorMin, setFactorMin] = useState<Record<(typeof CORE_FACTORS)[number], number>>({
    VALUATION: 0,
    GROWTH: 0,
    PROFITABILITY: 0,
    MOMENTUM: 0,
    REVISIONS: 0,
  });
  const [minQuant, setMinQuant] = useState<number>(0);
  const [hasDividend, setHasDividend] = useState<"any" | "yes" | "no">("any");
  const [sortKey, setSortKey] = useState<SortKey>("quant_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // --- 预设 ---
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  // 从 localStorage 恢复
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setCustomPresets(JSON.parse(raw) as Preset[]);
    } catch {
      /* ignore */
    }
  }, []);

  function persistCustom(next: Preset[]) {
    setCustomPresets(next);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    } catch {
      /* quota */
    }
  }

  function applyPreset(p: Preset) {
    setExchanges(new Set(p.exchanges));
    setVerdicts(new Set(p.verdicts));
    setSectors(new Set(p.sectors));
    setFactorMin({ ...EMPTY_FACTOR, ...p.factorMin });
    setMinQuant(p.minQuant);
    setHasDividend(p.hasDividend);
    setSortKey(p.sortKey);
    setSortDir(p.sortDir);
  }

  function currentSnapshot(name: string): Preset {
    return {
      name,
      exchanges: [...exchanges],
      verdicts: [...verdicts],
      sectors: [...sectors],
      factorMin: { ...factorMin },
      minQuant,
      hasDividend,
      sortKey,
      sortDir,
    };
  }

  function saveCustomPreset() {
    const name = prompt("命名这套筛选（例如：科技 + 强买 + 高 ROE）")?.trim();
    if (!name) return;
    if (BUILTIN_PRESETS.some((b) => b.name === name)) {
      alert("名称与内置预设冲突，请换一个");
      return;
    }
    const next = customPresets.filter((p) => p.name !== name);
    next.unshift(currentSnapshot(name));
    persistCustom(next.slice(0, 12)); // 最多 12 份
  }

  function deleteCustomPreset(name: string) {
    if (!confirm(`删除预设「${name}」？`)) return;
    persistCustom(customPresets.filter((p) => p.name !== name));
  }

  const allSectors = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.sector) set.add(r.sector);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (exchanges.size > 0 && !exchanges.has(r.exchange)) return false;
      if (sectors.size > 0 && (!r.sector || !sectors.has(r.sector))) return false;
      if (verdicts.size > 0 && (!r.ops_verdict || !verdicts.has(r.ops_verdict))) return false;
      if (minQuant > 0 && (r.quant_score == null || r.quant_score < minQuant)) return false;
      if (hasDividend === "yes" && r.has_dividend !== 1) return false;
      if (hasDividend === "no" && r.has_dividend === 1) return false;
      for (const f of CORE_FACTORS) {
        const min = factorMin[f];
        if (min === 0) continue;
        const g = r.grades[f];
        const gpa = gradeToGpa(g ?? null);
        if (gpa == null || gpa < min) return false;
      }
      return true;
    });
  }, [rows, exchanges, sectors, verdicts, minQuant, hasDividend, factorMin]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const get = (row: ScreenerRow): number | string => {
        if (sortKey === "symbol") return row.symbol;
        if (sortKey === "quant_score") return row.quant_score ?? -Infinity;
        if (sortKey === "rank_overall") {
          // 排名越小越好；空值放到末尾（按 dir 处理）
          return row.rank_overall ?? Number.POSITIVE_INFINITY;
        }
        const g = row.grades[sortKey as FactorKey];
        return gradeToGpa(g ?? null) ?? -Infinity;
      };
      const av = get(a);
      const bv = get(b);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      const an = av as number;
      const bn = bv as number;
      if (an === bn) return a.symbol.localeCompare(b.symbol);
      return (an < bn ? -1 : 1) * dir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = rows.length;
  const matched = sorted.length;

  function toggleSet<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function reset() {
    setExchanges(new Set());
    setSectors(new Set());
    setVerdicts(new Set());
    setMinQuant(0);
    setHasDividend("any");
    setFactorMin({ VALUATION: 0, GROWTH: 0, PROFITABILITY: 0, MOMENTUM: 0, REVISIONS: 0 });
    setSortKey("quant_score");
    setSortDir("desc");
  }

  function clickHeader(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  }

  const hasAnyFilter =
    exchanges.size > 0 ||
    sectors.size > 0 ||
    verdicts.size > 0 ||
    minQuant > 0 ||
    hasDividend !== "any" ||
    Object.values(factorMin).some((v) => v > 0);

  return (
    <div className="space-y-4">
      {/* ---------- 预设 ---------- */}
      <section className="card p-3">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <Bookmark className="h-3.5 w-3.5" strokeWidth={1.8} />
            预设
            <span className="text-[10px] font-normal text-muted">
              · 一键应用，本地保存
            </span>
          </h2>
          <button
            type="button"
            onClick={saveCustomPreset}
            disabled={!hasAnyFilter}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent-strong disabled:opacity-40"
            title={hasAnyFilter ? "把当前筛选保存为新预设" : "先选点筛选再保存"}
          >
            <Save className="h-3 w-3" strokeWidth={1.8} />
            保存当前
          </button>
        </header>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground-soft hover:border-accent hover:text-accent-strong"
            >
              {p.name}
            </button>
          ))}
          {customPresets.length > 0 ? (
            <span className="mx-1 text-[10px] text-muted self-center">|</span>
          ) : null}
          {customPresets.map((p) => (
            <span
              key={p.name}
              className="group relative inline-flex items-center rounded border border-border bg-surface text-[11px]"
            >
              <button
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-foreground-soft hover:text-accent-strong"
                title={p.name}
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => deleteCustomPreset(p.name)}
                className="border-l border-border px-1 py-1 text-muted hover:text-[color:var(--danger)]"
                aria-label="删除"
              >
                <Trash2 className="h-2.5 w-2.5" strokeWidth={1.8} />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* ---------- 筛选面板 ---------- */}
      <section className="card p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <Filter className="h-3.5 w-3.5" strokeWidth={1.8} />
            筛选条件
          </h2>
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-accent-strong"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              重置
            </button>
          ) : null}
        </header>

        {/* exchange chips */}
        <FilterRow label="市场">
          {EXCHANGES.map((e) => (
            <Chip
              key={e.value}
              active={exchanges.has(e.value)}
              onClick={() => setExchanges(toggleSet(exchanges, e.value))}
            >
              {e.label}
            </Chip>
          ))}
        </FilterRow>

        {/* verdict chips */}
        <FilterRow label="OPS 评级">
          {VERDICTS.map((v) => (
            <Chip
              key={v.value}
              active={verdicts.has(v.value)}
              onClick={() => setVerdicts(toggleSet(verdicts, v.value))}
            >
              {v.label}
            </Chip>
          ))}
        </FilterRow>

        {/* quant score min */}
        <FilterRow label={`最低 Quant 分（${minQuant.toFixed(1)} / 5.0）`}>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={minQuant}
            onChange={(e) => setMinQuant(Number(e.target.value))}
            className="w-full max-w-[280px] accent-[var(--accent)]"
          />
        </FilterRow>

        {/* 5 factor grades */}
        <FilterRow label="五因子评级（最低）">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CORE_FACTORS.map((f) => (
              <div key={f} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {FACTOR_LABELS[f]}
                </span>
                <select
                  value={factorMin[f]}
                  onChange={(e) =>
                    setFactorMin({ ...factorMin, [f]: Number(e.target.value) })
                  }
                  className="rounded border border-border bg-surface px-2 py-1 text-[12px] text-foreground"
                >
                  {GRADE_THRESHOLDS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </FilterRow>

        {/* sectors + dividend */}
        {allSectors.length > 0 ? (
          <FilterRow label="行业">
            {allSectors.map((s) => (
              <Chip key={s} active={sectors.has(s)} onClick={() => setSectors(toggleSet(sectors, s))}>
                {s}
              </Chip>
            ))}
          </FilterRow>
        ) : null}

        <FilterRow label="股息">
          {(["any", "yes", "no"] as const).map((opt) => (
            <Chip
              key={opt}
              active={hasDividend === opt}
              onClick={() => setHasDividend(opt)}
            >
              {opt === "any" ? "不限" : opt === "yes" ? "派息" : "不派息"}
            </Chip>
          ))}
        </FilterRow>
      </section>

      {/* ---------- 结果计数 ---------- */}
      <p className="text-[11px] text-muted">
        命中 <span className="mono font-bold text-accent-strong">{matched}</span> / {total} 个标的
        {sortKey !== "quant_score" || sortDir !== "desc" ? (
          <span className="ml-2">· 排序 {sortKey} {sortDir}</span>
        ) : null}
      </p>

      {/* ---------- 结果表 ---------- */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
              <Th onClick={() => clickHeader("symbol")} sortKey="symbol" curKey={sortKey} dir={sortDir}>
                代码
              </Th>
              <th className="px-3 py-2 font-normal">名称</th>
              <th className="px-3 py-2 font-normal">市场</th>
              <Th onClick={() => clickHeader("quant_score")} sortKey="quant_score" curKey={sortKey} dir={sortDir}>
                Quant
              </Th>
              <th className="px-3 py-2 font-normal">OPS</th>
              {CORE_FACTORS.map((f) => (
                <Th
                  key={f}
                  onClick={() => clickHeader(f as SortKey)}
                  sortKey={f as SortKey}
                  curKey={sortKey}
                  dir={sortDir}
                >
                  {FACTOR_LABELS[f]}
                </Th>
              ))}
              <Th onClick={() => clickHeader("rank_overall")} sortKey="rank_overall" curKey={sortKey} dir={sortDir}>
                排名
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol} className="border-b border-border last:border-b-0 hover:bg-surface-muted">
                <td className="px-3 py-2">
                  <Link
                    href={`/t/${encodeURIComponent(r.symbol)}`}
                    className="mono font-bold text-accent-strong hover:underline"
                  >
                    {r.symbol}
                  </Link>
                </td>
                <td className="px-3 py-2 text-foreground-soft">
                  <span className="line-clamp-1">{r.name}</span>
                </td>
                <td className="px-3 py-2 mono text-[11px] text-muted">{r.exchange}</td>
                <td className="px-3 py-2 mono">
                  {r.quant_score != null ? r.quant_score.toFixed(2) : <span className="text-muted">—</span>}
                </td>
                <td className="px-3 py-2">{verdictBadge(r.ops_verdict)}</td>
                {CORE_FACTORS.map((f) => {
                  const g = r.grades[f];
                  return (
                    <td key={f} className={`px-3 py-2 mono font-bold ${gradeColor(g)}`}>
                      {g ?? <span className="text-muted">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 mono text-[11px] text-muted">
                  {r.rank_overall != null
                    ? `${r.rank_overall}${r.rank_overall_total ? `/${r.rank_overall_total}` : ""}`
                    : "—"}
                </td>
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted">
                  没有符合条件的标的，试着放宽筛选
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 小组件 ----------

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[11px] transition ${
        active
          ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[#0a0a0d]"
          : "border-border bg-surface text-foreground-soft hover:border-foreground-soft hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Th({
  onClick,
  sortKey,
  curKey,
  dir,
  children,
}: {
  onClick: () => void;
  sortKey: SortKey;
  curKey: SortKey;
  dir: SortDir;
  children: React.ReactNode;
}) {
  const active = sortKey === curKey;
  return (
    <th className="px-3 py-2 font-normal">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-0.5 ${
          active ? "text-foreground" : "hover:text-foreground"
        }`}
      >
        {children}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" strokeWidth={2} />
          ) : (
            <ChevronDown className="h-3 w-3" strokeWidth={2} />
          )
        ) : null}
      </button>
    </th>
  );
}
