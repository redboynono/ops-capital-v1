import Link from "next/link";

import {
  getListPerformance,
  listAllConvictionLists,
  type ListPerformance,
} from "@/lib/conviction";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conviction Picks · OPS Alpha",
  description: "OPS Alpha 月度高信念榜单 — 公开记录，实时跟踪净值表现。",
};

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function pnlClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted";
  if (v > 0) return "text-[color:var(--success)]";
  if (v < 0) return "text-[color:var(--danger)]";
  return "text-foreground";
}

export default async function ConvictionIndexPage() {
  const lists = await listAllConvictionLists();

  // 并行拉每份 list 的实时 performance（公开页只需要总回报）
  const perfs = await Promise.all(lists.map((l) => getListPerformance(l.id)));
  const enriched: ListPerformance[] = perfs.filter((p): p is ListPerformance => p != null);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Conviction Picks</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">高信念榜单</h1>
        <p className="mt-1 text-[13px] text-muted">
          OPS Alpha 每月精选 5–10 只最高信念标的，公开记录建仓价格、权重与逻辑，实时跟踪净值。
        </p>
      </header>

      {enriched.length === 0 ? (
        <div className="card px-4 py-12 text-center text-[13px] text-muted">
          <p className="mb-1 text-[16px] font-semibold text-foreground">尚未发布榜单</p>
          <p>第一期 Conviction Picks 即将发布。</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {enriched.map((perf) => (
            <ListCard key={perf.list.id} perf={perf} />
          ))}
        </div>
      )}

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        说明：榜单公开发布后即"建仓"。当期回报基于发布日 entry_price 与 Finnhub 实时报价计算（加权平均）。仅记录研究观点，不构成投资建议。
      </p>
    </div>
  );
}

function ListCard({ perf }: { perf: ListPerformance }) {
  const { list, picks, total_return_pct, best, worst } = perf;
  const active = list.is_active === 1 && !list.end_date;
  return (
    <Link
      href={`/conviction/${list.id}`}
      className="card row-hover block p-4"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="label-caps text-[10px]">
            {list.publish_date} · {picks.length} 只
            {active ? <span className="ml-2 text-accent-strong">● ACTIVE</span> : null}
          </p>
          <h2 className="mt-0.5 text-[16px] font-bold text-foreground">{list.period_label}</h2>
        </div>
        <div className={`text-right mono ${pnlClass(total_return_pct)}`}>
          <p className="text-[10px] text-muted">当期净值</p>
          <p className="text-xl font-bold">{fmtPct(total_return_pct)}</p>
        </div>
      </header>

      {list.thesis ? (
        <p className="mb-2 line-clamp-2 text-[12px] text-foreground-soft">{list.thesis}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
        <div>
          <p className="text-[10px] text-muted">表现最好</p>
          <p className={`mono font-semibold ${pnlClass(best?.return_pct ?? null)}`}>
            {best ? `${best.symbol} ${fmtPct(best.return_pct)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted">表现最差</p>
          <p className={`mono font-semibold ${pnlClass(worst?.return_pct ?? null)}`}>
            {worst ? `${worst.symbol} ${fmtPct(worst.return_pct)}` : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
