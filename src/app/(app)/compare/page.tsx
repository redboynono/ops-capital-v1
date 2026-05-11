import Link from "next/link";

import { ComparePicker } from "@/components/compare-picker";
import { Sparkline } from "@/components/sparkline";
import { COMPARE_MAX, loadCompareData, parseCompareSymbols, type CompareColumn } from "@/lib/compare";
import type { FactorKey, Grade, Verdict } from "@/lib/ratings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compare · OPS Alpha",
  description: "多标的并排对比 — 实时报价、估值倍数、OPS Quant 评级、五因子、近期 news。",
};

const CORE_FACTORS = ["VALUATION", "GROWTH", "PROFITABILITY", "MOMENTUM", "REVISIONS"] as const;
const FACTOR_LABEL: Record<(typeof CORE_FACTORS)[number], string> = {
  VALUATION: "估值",
  GROWTH: "成长",
  PROFITABILITY: "盈利",
  MOMENTUM: "动能",
  REVISIONS: "上调",
};

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY: "#166534",
  BUY: "#15803d",
  HOLD: "#ca8a04",
  SELL: "#dc2626",
  STRONG_SELL: "#991b1b",
};
const VERDICT_LABEL: Record<Verdict, string> = {
  STRONG_BUY: "强买",
  BUY: "买入",
  HOLD: "持有",
  SELL: "卖出",
  STRONG_SELL: "强卖",
};

function gradeColor(g: Grade | null | undefined): string {
  if (!g) return "text-muted";
  if (g.startsWith("A")) return "text-emerald-500";
  if (g.startsWith("B")) return "text-lime-500";
  if (g.startsWith("C")) return "text-amber-500";
  if (g.startsWith("D")) return "text-orange-500";
  return "text-red-500";
}

function fmtMoney(v: number | null | undefined, currency = "USD") {
  if (v == null || !Number.isFinite(v)) return "—";
  const sym = currency === "USD" ? "$" : "";
  return `${sym}${v.toFixed(2)}`;
}
function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtMcap(millions: number | null | undefined) {
  if (millions == null || !Number.isFinite(millions) || millions <= 0) return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(0)}M`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(d);
}

function VerdictBadge({ v }: { v: Verdict | null | undefined }) {
  if (!v) return <span className="text-muted">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold tracking-wide text-white"
      style={{ background: VERDICT_BG[v] }}
    >
      {VERDICT_LABEL[v]}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted">{children}</p>
  );
}

function MetricRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="mono font-semibold text-foreground">{children}</span>
    </div>
  );
}

function ColumnCard({ col }: { col: CompareColumn }) {
  const { symbol, profile, quote, metric, news, rating, grades, ticker, history } = col;
  const m = metric?.metric ?? {};
  const change = quote?.dp ?? null;
  const changeClass =
    change == null
      ? "text-muted"
      : change > 0
        ? "text-[color:var(--success)]"
        : change < 0
          ? "text-[color:var(--danger)]"
          : "text-foreground";

  const name = profile?.name ?? ticker?.name ?? symbol;
  const exchange = ticker?.exchange ?? profile?.exchange?.split(",")[0] ?? "—";
  const sector = ticker?.sector ?? profile?.finnhubIndustry ?? null;

  return (
    <div className="card flex flex-col p-3">
      {/* Header */}
      <header className="border-b border-border pb-2">
        <Link
          href={`/t/${encodeURIComponent(symbol)}`}
          className="mono text-lg font-bold text-accent-strong hover:underline"
        >
          {symbol}
        </Link>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-foreground-soft">{name}</p>
        <p className="mt-0.5 text-[10px] mono text-muted">
          {exchange}
          {sector ? <> · {sector}</> : null}
        </p>
      </header>

      {/* Quote */}
      <section className="border-b border-border py-2">
        <div className="flex items-baseline gap-2">
          <span className="mono text-xl font-bold">
            {quote ? fmtMoney(quote.c, profile?.currency ?? "USD") : "—"}
          </span>
          <span className={`mono text-[12px] ${changeClass}`}>{fmtPct(change)}</span>
        </div>
        <p className="mt-0.5 text-[10px] mono text-muted">
          日内 {fmtMoney(quote?.l)} – {fmtMoney(quote?.h)}
          {quote?.pc ? <> · 前收 {fmtMoney(quote.pc)}</> : null}
        </p>
        {/* 1Y sparkline */}
        <div className="mt-2 flex items-center justify-between">
          <span className="label-caps text-[9px]">1Y 走势</span>
        </div>
        {history && history.points.length > 1 ? (
          <Sparkline points={history.points} width={240} height={44} />
        ) : (
          <div className="mt-0.5 flex h-11 items-center justify-center text-[10px] text-muted">
            无价格历史
          </div>
        )}
      </section>

      {/* Valuation / financials */}
      <section className="border-b border-border py-2">
        <SectionTitle>估值 / 财务</SectionTitle>
        <MetricRow label="市值">
          {fmtMcap(profile?.marketCapitalization ?? (m.marketCapitalization ?? null))}
        </MetricRow>
        <MetricRow label="PE TTM">{fmtNum(m.peTTM ?? null)}</MetricRow>
        <MetricRow label="PS TTM">{fmtNum(m.psTTM ?? null)}</MetricRow>
        <MetricRow label="PB">{fmtNum(m.pbAnnual ?? null)}</MetricRow>
        <MetricRow label="EPS TTM">{fmtNum(m.epsTTM ?? null)}</MetricRow>
        <MetricRow label="毛利率%">{fmtNum(m.grossMarginTTM ?? null)}</MetricRow>
        <MetricRow label="净利率%">{fmtNum(m.netProfitMarginTTM ?? null)}</MetricRow>
        <MetricRow label="ROE TTM%">{fmtNum(m.roeTTM ?? null)}</MetricRow>
        <MetricRow label="Beta">{fmtNum(m.beta ?? null)}</MetricRow>
        <MetricRow label="股息率%">{fmtNum(m.dividendYieldIndicatedAnnual ?? null)}</MetricRow>
        <MetricRow label="52W 高">{fmtNum(m["52WeekHigh"] ?? null)}</MetricRow>
        <MetricRow label="52W 低">{fmtNum(m["52WeekLow"] ?? null)}</MetricRow>
      </section>

      {/* Ratings */}
      <section className="border-b border-border py-2">
        <SectionTitle>OPS 评级</SectionTitle>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted">OPS</span>
          <span className="flex items-center gap-1.5">
            <VerdictBadge v={rating?.ops_verdict} />
            <span className="mono">{rating?.ops_score != null ? rating.ops_score.toFixed(2) : "—"}</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted">Street</span>
          <span className="flex items-center gap-1.5">
            <VerdictBadge v={rating?.street_verdict} />
            <span className="mono">{rating?.street_score != null ? rating.street_score.toFixed(2) : "—"}</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted">Quant</span>
          <span className="mono font-semibold">
            {rating?.quant_score != null ? rating.quant_score.toFixed(2) : "—"}
          </span>
        </div>
      </section>

      {/* Factor grades */}
      <section className="border-b border-border py-2">
        <SectionTitle>五因子</SectionTitle>
        <div className="grid grid-cols-5 gap-1">
          {CORE_FACTORS.map((f) => {
            const g = grades[f as FactorKey];
            return (
              <div key={f} className="flex flex-col items-center gap-0.5 rounded border border-border bg-surface-muted py-1">
                <span className={`mono text-[12px] font-bold ${gradeColor(g)}`}>{g ?? "—"}</span>
                <span className="text-[9px] text-muted">{FACTOR_LABEL[f]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* News */}
      <section className="pt-2">
        <SectionTitle>近 14 天新闻</SectionTitle>
        {news.length === 0 ? (
          <p className="text-[11px] text-muted">无近期 news</p>
        ) : (
          <ul className="space-y-1.5">
            {news.slice(0, 3).map((n) => (
              <li key={`${n.id}-${n.datetime}`}>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] leading-snug text-foreground-soft hover:text-accent-strong"
                >
                  <span className="mono text-[9px] text-muted">
                    {new Date(n.datetime * 1000).toISOString().slice(0, 10)}
                  </span>{" "}
                  {n.headline}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card mt-4 px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-1.5 text-[16px] font-semibold text-foreground">还没选标的</p>
      <p>
        点击上方「添加」选 2–4 只标的，并排对比 估值 / 评级 / 五因子 / 近期新闻。
      </p>
      <p className="mt-3 text-[11px]">
        小贴士：URL 自带 <code className="rounded bg-surface px-1.5 py-0.5 mono">?symbols=NVDA,AMD,TSM</code> ，方便分享。
      </p>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ symbols?: string | string[] }>;
}) {
  const sp = await searchParams;
  const symbols = parseCompareSymbols(sp.symbols);
  const cols = symbols.length > 0 ? await loadCompareData(symbols) : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Compare</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">多标的对比</h1>
        <p className="mt-1 text-[13px] text-muted">
          并排对比最多 {COMPARE_MAX} 只标的 · 实时报价 + 估值倍数 + OPS 评级 + 五因子 + 近期新闻
        </p>
      </header>

      <ComparePicker current={symbols} />

      {cols.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {cols.map((col) => (
            <ColumnCard key={col.symbol} col={col} />
          ))}
        </div>
      )}
    </div>
  );
}
