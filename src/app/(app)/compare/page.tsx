import Link from "next/link";

import { ComparePicker } from "@/components/compare-picker";
import { FactorRadar } from "@/components/factor-radar";
import { Sparkline } from "@/components/sparkline";
import { COMPARE_MAX, loadCompareData, parseCompareSymbols, type CompareColumn } from "@/lib/compare";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Locale } from "@/lib/i18n/locale-types";
import type { Dictionary } from "@/lib/i18n/zh";
import { CORE_FACTORS, CRYPTO_FACTORS, type FactorKey, type Verdict } from "@/lib/ratings";

export const dynamic = "force-dynamic";

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY: "#166534",
  BUY: "#15803d",
  HOLD: "#ca8a04",
  SELL: "#dc2626",
  STRONG_SELL: "#991b1b",
};

function gradeColor(g: string | null | undefined): string {
  if (!g) return "text-muted";
  if (g.startsWith("A")) return "text-emerald-500";
  if (g.startsWith("B")) return "text-lime-500";
  if (g.startsWith("C")) return "text-amber-500";
  if (g.startsWith("D")) return "text-orange-500";
  return "text-red-500";
}

function factorShortLabel(
  key: FactorKey,
  locale: Locale,
  cmp: Dictionary["compare"],
  rdict: Dictionary["ratings"],
): string {
  const short = (cmp.factorsShort as Record<string, string>)[key];
  if (short) return short;
  const full = (rdict.factors as Record<string, string>)[key];
  if (!full) return key;
  return locale === "en" ? (full.split(" ").pop() ?? full) : (full.split(" ")[0] ?? full);
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

function VerdictBadge({ v, cmp }: { v: Verdict | null | undefined; cmp: Dictionary["compare"] }) {
  if (!v) return <span className="text-muted">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold tracking-wide text-white"
      style={{ background: VERDICT_BG[v] }}
    >
      {cmp.verdicts[v]}
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

function ColumnCard({
  col,
  cmp,
  rdict,
  locale,
}: {
  col: CompareColumn;
  cmp: Dictionary["compare"];
  rdict: Dictionary["ratings"];
  locale: Locale;
}) {
  const { symbol, profile, quote, metric, news, rating, grades, ticker, history, isCrypto } = col;
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

      <section className="border-b border-border py-2">
        <div className="flex items-baseline gap-2">
          <span className="mono text-xl font-bold">
            {quote ? fmtMoney(quote.c, profile?.currency ?? "USD") : "—"}
          </span>
          <span className={`mono text-[12px] ${changeClass}`}>{fmtPct(change)}</span>
        </div>
        <p className="mt-0.5 text-[10px] mono text-muted">
          {fmt(cmp.intradayFmt, {
            low: fmtMoney(quote?.l),
            high: fmtMoney(quote?.h),
          })}
          {quote?.pc ? <> {fmt(cmp.prevCloseFmt, { price: fmtMoney(quote.pc) })}</> : null}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="label-caps text-[9px]">{cmp.trend1y}</span>
        </div>
        {history && history.points.length > 1 ? (
          <Sparkline points={history.points} width={240} height={44} />
        ) : (
          <div className="mt-0.5 flex h-11 items-center justify-center text-[10px] text-muted">
            {cmp.noPriceHistory}
          </div>
        )}
      </section>

      <section className={isCrypto ? "hidden" : "border-b border-border py-2"}>
        <SectionTitle>{cmp.valuation}</SectionTitle>
        <MetricRow label={cmp.marketCap}>
          {fmtMcap(profile?.marketCapitalization ?? (m.marketCapitalization ?? null))}
        </MetricRow>
        <MetricRow label="PE TTM">{fmtNum(m.peTTM ?? null)}</MetricRow>
        <MetricRow label="PS TTM">{fmtNum(m.psTTM ?? null)}</MetricRow>
        <MetricRow label="PB">{fmtNum(m.pbAnnual ?? null)}</MetricRow>
        <MetricRow label="EPS TTM">{fmtNum(m.epsTTM ?? null)}</MetricRow>
        <MetricRow label={cmp.grossMargin}>{fmtNum(m.grossMarginTTM ?? null)}</MetricRow>
        <MetricRow label={cmp.netMargin}>{fmtNum(m.netProfitMarginTTM ?? null)}</MetricRow>
        <MetricRow label={cmp.roe}>{fmtNum(m.roeTTM ?? null)}</MetricRow>
        <MetricRow label="Beta">{fmtNum(m.beta ?? null)}</MetricRow>
        <MetricRow label={cmp.divYield}>{fmtNum(m.dividendYieldIndicatedAnnual ?? null)}</MetricRow>
        <MetricRow label={cmp.high52}>{fmtNum(m["52WeekHigh"] ?? null)}</MetricRow>
        <MetricRow label={cmp.low52}>{fmtNum(m["52WeekLow"] ?? null)}</MetricRow>
      </section>

      <section className="border-b border-border py-2">
        <SectionTitle>{cmp.ratings}</SectionTitle>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted">OPS</span>
          <span className="flex items-center gap-1.5">
            <VerdictBadge v={rating?.ops_verdict} cmp={cmp} />
            <span className="mono">{rating?.ops_score != null ? rating.ops_score.toFixed(2) : "—"}</span>
          </span>
        </div>
        {!isCrypto ? (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">{rdict.street}</span>
            <span className="flex items-center gap-1.5">
              <VerdictBadge v={rating?.street_verdict} cmp={cmp} />
              <span className="mono">{rating?.street_score != null ? rating.street_score.toFixed(2) : "—"}</span>
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted">Quant</span>
          <span className="mono font-semibold">
            {rating?.quant_score != null ? rating.quant_score.toFixed(2) : "—"}
          </span>
        </div>
      </section>

      <section className="border-b border-border py-2">
        <SectionTitle>{isCrypto ? cmp.cryptoFactors : cmp.factors}</SectionTitle>
        {isCrypto ? (
          <FactorRadar
            uid={`cmp-${symbol}`}
            axes={CRYPTO_FACTORS.map((f) => ({
              label: factorShortLabel(f, locale, cmp, rdict),
              grade: grades[f as FactorKey] ?? null,
            }))}
          />
        ) : (
          <div className="grid grid-cols-5 gap-1">
            {CORE_FACTORS.map((f) => {
              const g = grades[f as FactorKey];
              return (
                <div key={f} className="flex flex-col items-center gap-0.5 rounded border border-border bg-surface-muted py-1">
                  <span className={`mono text-[12px] font-bold ${gradeColor(g)}`}>{g ?? "—"}</span>
                  <span className="text-[9px] text-muted">{cmp.factorsShort[f]}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="pt-2">
        <SectionTitle>{cmp.news14d}</SectionTitle>
        {news.length === 0 ? (
          <p className="text-[11px] text-muted">{cmp.noRecentNews}</p>
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

function EmptyState({ cmp }: { cmp: Dictionary["compare"] }) {
  return (
    <div className="card mt-4 px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-1.5 text-[16px] font-semibold text-foreground">{cmp.emptyTitle}</p>
      <p>{cmp.emptyBody}</p>
      <p className="mt-3 text-[11px]">{cmp.emptyTip}</p>
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
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const cmp = dict.compare;
  const rdict = dict.ratings;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{cmp.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{cmp.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{fmt(cmp.subtitle, { max: COMPARE_MAX })}</p>
      </header>

      <ComparePicker current={symbols} />

      {cols.length === 0 ? (
        <EmptyState cmp={cmp} />
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, minmax(0, 1fr))`,
          }}
        >
          {cols.map((col) => (
            <ColumnCard key={col.symbol} col={col} cmp={cmp} rdict={rdict} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
