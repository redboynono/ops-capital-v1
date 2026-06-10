import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTrackRecord, type TrackRecordRow } from "@/lib/track-record";
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
        ) : null}
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

export default async function TrackRecordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/track-record");

  const tr = await getTrackRecord();

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Track Record</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">评级战绩</h1>
        <p className="mt-1 text-[13px] text-muted">
          当前评级自连续保持起点以来的真实收益 · 对比同期 SPY · 基于每日评级快照，不可回填
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="BUY 组跑赢 SPY 比例"
          value={tr.buyWinRate != null ? `${tr.buyWinRate.toFixed(0)}%` : "—"}
          sub={`样本 ${tr.buyCount} 个 BUY / STRONG BUY`}
        />
        <SummaryCard label="BUY 组平均收益" value={pct(tr.buyAvgReturn)} sub="评级发出以来" />
        <SummaryCard label="BUY 组平均超额" value={pct(tr.buyAvgExcess)} sub="相对同期 SPY" />
      </div>

      {tr.rows.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-[13px] text-muted">
          历史快照不足，战绩将随每日评级快照自动积累。
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto">
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
              {tr.rows.map((r) => (
                <Row key={r.symbol} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-soft">
        方法说明：起点为该标的当前评级在每日快照中连续保持的最早时间；起始价取起点后第一个收盘价（Yahoo），
        加密标的以 -USD 计价。SELL/STRONG SELL 的「正确」表现为负收益。历史快照自评级体系上线起积累，样本随时间增长。
        本页数据仅供研究参考，不构成投资建议。
      </p>
    </div>
  );
}
