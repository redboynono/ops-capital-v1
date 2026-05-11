import Link from "next/link";
import { notFound } from "next/navigation";

import { getListPerformance } from "@/lib/conviction";

export const dynamic = "force-dynamic";

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}
function fmtMoney(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}
function pnlClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted";
  if (v > 0) return "text-[color:var(--success)]";
  if (v < 0) return "text-[color:var(--danger)]";
  return "text-foreground";
}

export default async function ConvictionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perf = await getListPerformance(id);
  if (!perf) notFound();

  const { list, picks, total_return_pct, benchmark, alpha_pct } = perf;
  const active = list.is_active === 1 && !list.end_date;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/conviction" className="hover:text-accent-strong">
          Conviction Picks
        </Link>
        <span className="mx-1">/</span>
        <span>{list.period_label}</span>
      </nav>

      <header className="mt-3 card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-caps text-[10px]">
              {list.publish_date}
              {list.end_date ? <> → {list.end_date}</> : null}
              {active ? <span className="ml-2 text-accent-strong">● ACTIVE</span> : null}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{list.period_label}</h1>
          </div>
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-right mono">
            <div className={pnlClass(total_return_pct)}>
              <p className="label-caps text-[10px]">当期加权净值</p>
              <p className="text-3xl font-bold">{fmtPct(total_return_pct)}</p>
            </div>
            {benchmark ? (
              <div className={pnlClass(benchmark.return_pct)}>
                <p className="label-caps text-[10px]">SPY 同期</p>
                <p className="text-xl font-semibold">{fmtPct(benchmark.return_pct)}</p>
              </div>
            ) : null}
            {alpha_pct != null ? (
              <div className={pnlClass(alpha_pct)}>
                <p className="label-caps text-[10px]">超额收益 α</p>
                <p className="text-xl font-semibold">{fmtPct(alpha_pct)}</p>
              </div>
            ) : null}
          </div>
        </div>
        {list.thesis ? (
          <p className="mt-3 border-t border-border pt-3 text-[13px] text-foreground-soft whitespace-pre-wrap">
            {list.thesis}
          </p>
        ) : null}
      </header>

      <section className="mt-4 card overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-normal">代码</th>
              <th className="px-3 py-2 font-normal text-right">权重</th>
              <th className="px-3 py-2 font-normal text-right">建仓价</th>
              <th className="px-3 py-2 font-normal text-right">现价</th>
              <th className="px-3 py-2 font-normal text-right">回报</th>
              <th className="px-3 py-2 font-normal text-right">加权贡献</th>
              <th className="px-3 py-2 font-normal">逻辑</th>
            </tr>
          </thead>
          <tbody>
            {picks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  本榜单暂无标的
                </td>
              </tr>
            ) : (
              picks.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-surface-muted">
                  <td className="px-3 py-2">
                    <Link
                      href={`/t/${encodeURIComponent(p.symbol)}`}
                      className="mono font-bold text-accent-strong hover:underline"
                    >
                      {p.symbol}
                    </Link>
                    {p.ticker_name ? (
                      <p className="text-[10px] text-muted line-clamp-1">{p.ticker_name}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 mono text-right text-foreground-soft">
                    {(p.weight * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 mono text-right">{fmtMoney(p.entry_price)}</td>
                  <td className="px-3 py-2 mono text-right">{fmtMoney(p.current_price)}</td>
                  <td className={`px-3 py-2 mono text-right font-bold ${pnlClass(p.return_pct)}`}>
                    {fmtPct(p.return_pct)}
                  </td>
                  <td className={`px-3 py-2 mono text-right ${pnlClass(p.weighted_contribution)}`}>
                    {fmtPct(p.weighted_contribution)}
                  </td>
                  <td className="px-3 py-2 text-foreground-soft">
                    <span className="line-clamp-2">{p.thesis ?? "—"}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        说明：每份榜单于 publish_date 建仓，当期净值 = sum(weight × return) / sum(weight)；该计算公平对待无法实时定价的标的。本榜单为研究记录，不构成投资建议。
      </p>
    </div>
  );
}
