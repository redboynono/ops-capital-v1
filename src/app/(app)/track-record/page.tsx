import Link from "next/link";
import { getTrackRecord, type TrackRecordRow } from "@/lib/track-record";
import { getLocale } from "@/lib/i18n";
import { VERDICT_LABELS, type Verdict } from "@/lib/ratings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "评级战绩 · OPS Alpha",
  description: "OPS 评级发出以来的真实收益 vs SPY 基准，公开可验证。",
};

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY: "#166534",
  BUY: "#15803d",
  HOLD: "#ca8a04",
  SELL: "#dc2626",
  STRONG_SELL: "#7f1d1d",
};

function pct(v: number | null, signed = true) {
  if (v == null) return "—";
  return `${signed && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function pctClass(v: number | null) {
  if (v == null) return "text-muted";
  return v > 0 ? "text-[color:var(--success)]" : v < 0 ? "text-[color:var(--danger)]" : "text-foreground";
}
function price(v: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

function HighlightCard({ r, en }: { r: TrackRecordRow; en: boolean }) {
  return (
    <Link
      href={`/t/${r.symbol}`}
      className="card block p-4 transition hover:border-accent hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-bold text-accent-strong">{r.symbol}</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{r.name}</p>
        </div>
        <span
          className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
          style={{ background: VERDICT_BG[r.verdict] }}
        >
          {VERDICT_LABELS[r.verdict].en}
        </span>
      </div>
      <p className={`mt-3 font-mono text-2xl font-bold ${pctClass(r.excessPct)}`}>
        {pct(r.excessPct)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        {en ? "excess vs SPY" : "相对 SPY 超额"} · {en ? "since" : "自"} {r.since} ({r.days}d)
      </p>
      <p className="mt-1 font-mono text-[11px] text-foreground-soft">
        {en ? "Return" : "收益"} {pct(r.returnPct)} · SPY {pct(r.spyPct)}
      </p>
    </Link>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <p className="label-caps text-[10px] text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

function Row({ r }: { r: TrackRecordRow }) {
  return (
    <tr className="hover:bg-surface-muted">
      <td className="px-3 py-2.5">
        <Link href={`/t/${r.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
          {r.symbol}
        </Link>
        <span className="ml-2 text-muted">{r.name}</span>
        {r.asset_class === "crypto" ? (
          <span className="ml-2 rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted">加密</span>
        ) : r.asset_class === "equity" && !/^\d/.test(r.symbol) ? null : (
          <span className="ml-2 rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted">港/其他</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span
          className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
          style={{ background: VERDICT_BG[r.verdict] }}
        >
          {VERDICT_LABELS[r.verdict].en}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center font-mono text-muted">
        {r.since}
        <span className="ml-1 text-[10px]">({r.days}d)</span>
      </td>
      <td className="px-3 py-2.5 text-right font-mono">{price(r.startPrice)}</td>
      <td className="px-3 py-2.5 text-right font-mono">{price(r.lastPrice)}</td>
      <td className={`px-3 py-2.5 text-right font-mono font-bold ${pctClass(r.returnPct)}`}>{pct(r.returnPct)}</td>
      <td className="px-3 py-2.5 text-right font-mono text-muted">{pct(r.spyPct)}</td>
      <td className={`px-3 py-2.5 text-right font-mono font-bold ${pctClass(r.excessPct)}`}>{pct(r.excessPct)}</td>
    </tr>
  );
}

function TableSection({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: TrackRecordRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card mt-4 p-6 text-center text-[13px] text-muted">{empty}</div>
    );
  }
  return (
    <div className="card mt-4 overflow-x-auto">
      <div className="border-b border-border px-4 py-2">
        <span className="label-caps">{title}</span>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2">标的</th>
            <th className="px-3 py-2 text-center">评级</th>
            <th className="px-3 py-2 text-center">起点</th>
            <th className="px-3 py-2 text-right">起始价</th>
            <th className="px-3 py-2 text-right">现价</th>
            <th className="px-3 py-2 text-right">收益</th>
            <th className="px-3 py-2 text-right">SPY 同期</th>
            <th className="px-3 py-2 text-right">超额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <Row key={r.symbol} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TrackRecordPage() {
  const locale = await getLocale();
  const en = locale === "en";
  const tr = await getTrackRecord();

  const buyRows = tr.rows.filter((r) => r.verdict === "BUY" || r.verdict === "STRONG_BUY");
  const sellRows = tr.rows.filter((r) => r.verdict === "SELL" || r.verdict === "STRONG_SELL");
  const usBuyRows = buyRows.filter((r) => r.asset_class === "equity" && !/^\d/.test(r.symbol));
  const usSymbols = new Set(usBuyRows.map((r) => r.symbol));
  const otherBuyRows = buyRows.filter((r) => !usSymbols.has(r.symbol));

  const t = {
    title: en ? "Ratings Track Record" : "评级战绩",
    subtitle: en
      ? "Live returns since each rating event vs SPY · daily snapshots, no backfill"
      : "自评级变动事件起算的真实收益 · 对比同期 SPY · 每日快照，不可回填",
    picksLink: en ? "OPS Picks (actionable calls) →" : "OPS 精选（可跟单战绩）→",
    accumulating: en
      ? `Sample building (${tr.buyCount} BUY calls). Headline stats below are indicative only until n≥20.`
      : `样本积累中（当前 ${tr.buyCount} 个 BUY）。聚合指标仅供参考，满 20 个 BUY 后更具统计意义。`,
    highlights: en ? "Top BUY vs SPY" : "BUY 组亮点（超额 Top）",
    aggregates: en ? "BUY group aggregates" : "BUY 组聚合（参考）",
    buyWin: en ? "Beat SPY rate" : "跑赢 SPY 比例",
    buyRet: en ? "Avg return" : "平均收益",
    buyExcess: en ? "Avg excess" : "平均超额",
    sellCorrect: en ? "SELL correct (↓)" : "SELL 组看空正确率",
    otherBuys: en ? "Other · BUY" : "港/加密 · BUY",
    usBuys: en ? "US equities · BUY" : "美股 · BUY",
    sells: en ? "SELL / STRONG SELL" : "SELL / STRONG SELL",
    empty: en ? "Not enough history yet." : "历史快照不足，战绩将随每日快照自动积累。",
    method: en
      ? "Method: start = most recent entry into the current verdict bucket (e.g. HOLD→BUY). Start price = first close after the event (Massive for US / Yahoo for HK & crypto). Negative SELL returns count as correct calls. For curated entry/exit performance see OPS Picks."
      : "方法说明：起点 = 最近一次进入当前评级桶的时间（如 HOLD→BUY）；起始价取事件后首个收盘价（美股 Massive / 港加密 Yahoo）。SELL 组负收益视为「看空正确」。可跟单战绩见 OPS 精选。",
    disclaimer: en
      ? "Research only · not investment advice."
      : "仅供研究参考，不构成投资建议。",
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Track Record</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{t.subtitle}</p>
        <Link href="/picks" className="mt-2 inline-block text-[12px] text-accent-strong hover:underline">
          {t.picksLink}
        </Link>
      </header>

      {tr.accumulating ? (
        <div className="mb-4 rounded-lg border border-border bg-surface-muted px-3 py-2 text-[12px] text-muted">
          {t.accumulating}
        </div>
      ) : null}

      {tr.topBuys.length > 0 ? (
        <section className="mb-4">
          <h2 className="label-caps mb-2 text-[11px] text-muted">{t.highlights}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {tr.topBuys.map((r) => (
              <HighlightCard key={r.symbol} r={r} en={en} />
            ))}
          </div>
        </section>
      ) : null}

      {tr.buyCount > 0 ? (
        <section className="mb-2">
          <h2 className="label-caps mb-2 text-[11px] text-muted">{t.aggregates}</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryCard
              label={t.buyWin}
              value={tr.buyWinRate != null ? `${tr.buyWinRate.toFixed(0)}%` : "—"}
              sub={en ? `${tr.buyCount} BUY calls` : `样本 ${tr.buyCount} 个 BUY`}
            />
            <SummaryCard label={t.buyRet} value={pct(tr.buyAvgReturn)} sub={en ? "since rating event" : "评级事件以来"} />
            <SummaryCard label={t.buyExcess} value={pct(tr.buyAvgExcess)} sub={en ? "vs SPY" : "相对 SPY"} />
            {tr.sellCount > 0 ? (
              <SummaryCard
                label={t.sellCorrect}
                value={tr.sellCorrectRate != null ? `${tr.sellCorrectRate.toFixed(0)}%` : "—"}
                sub={en ? `${tr.sellCount} SELL calls` : `${tr.sellCount} 个 SELL`}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {tr.rows.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-[13px] text-muted">{t.empty}</div>
      ) : (
        <>
          {usBuyRows.length > 0 ? (
            <TableSection title={t.usBuys} rows={usBuyRows} empty={t.empty} />
          ) : null}
          {otherBuyRows.length > 0 ? (
            <TableSection title={t.otherBuys} rows={otherBuyRows} empty={t.empty} />
          ) : null}
          {sellRows.length > 0 ? (
            <TableSection title={t.sells} rows={sellRows} empty={t.empty} />
          ) : null}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-soft">
        {t.method} {t.disclaimer}
      </p>
    </div>
  );
}
