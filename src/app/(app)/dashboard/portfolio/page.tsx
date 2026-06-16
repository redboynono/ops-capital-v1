import Link from "next/link";
import { redirect } from "next/navigation";

import { AddPositionForm, PositionRowActions } from "@/components/position-editor";
import { getSessionUser } from "@/lib/auth";
import { getPortfolioSummary, type EnrichedPosition } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "模拟盘 · OPS Alpha",
  description: "追踪你的持仓 + 实时 P&L + 当日浮动盈亏",
};

function fmtMoney(v: number | null, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}
function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}
function fmtPctRaw(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
function pnlClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted";
  if (v > 0) return "text-[color:var(--success)]";
  if (v < 0) return "text-[color:var(--danger)]";
  return "text-foreground";
}

export default async function PortfolioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const summary = await getPortfolioSummary(user.id);
  const positions = summary.positions;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Portfolio</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">模拟盘</h1>
        <p className="mt-1 text-[13px] text-muted">
          追踪你的持仓 + 实时市值 + 累计/当日 P&L · 仅记录数量与建仓均价（无现金 / 不计交易费）
        </p>
      </header>

      {positions.length === 0 ? (
        <div className="card mb-4 px-4 py-12 text-center text-[13px] text-muted">
          <p className="mb-2 text-[16px] font-semibold text-foreground">还没有持仓</p>
          <p className="mb-4">
            添加你的第一只股票开始追踪。同一 ticker 重复添加会覆盖。
          </p>
          <div className="inline-block">
            <AddPositionForm />
          </div>
        </div>
      ) : (
        <>
          {/* 顶部摘要 */}
          <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="总市值"
              value={fmtMoney(summary.total_market_value)}
              sub={`成本 ${fmtMoney(summary.total_cost_basis)}`}
            />
            <SummaryTile
              label="累计 P&L"
              value={fmtMoney(summary.total_pnl_abs)}
              sub={fmtPct(summary.total_pnl_pct)}
              tone={summary.total_pnl_abs}
            />
            <SummaryTile
              label="当日 P&L"
              value={fmtMoney(summary.day_pnl_abs)}
              sub={fmtPct(summary.day_pnl_pct)}
              tone={summary.day_pnl_abs}
            />
            <SummaryTile
              label="持仓数"
              value={String(positions.length)}
              sub={
                summary.unpriced_count > 0
                  ? `${summary.unpriced_count} 只无实时报价`
                  : "全部已实时定价"
              }
            />
          </section>

          {/* 持仓表 */}
          <section className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">代码</th>
                  <th className="px-3 py-2 font-normal text-right">数量</th>
                  <th className="px-3 py-2 font-normal text-right">均价</th>
                  <th className="px-3 py-2 font-normal text-right">现价</th>
                  <th className="px-3 py-2 font-normal text-right">日内</th>
                  <th className="px-3 py-2 font-normal text-right">市值</th>
                  <th className="px-3 py-2 font-normal text-right">P&L</th>
                  <th className="px-3 py-2 font-normal text-right">权重</th>
                  <th className="px-3 py-2 font-normal text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .sort(
                    (a, b) =>
                      (b.market_value ?? 0) - (a.market_value ?? 0) ||
                      a.symbol.localeCompare(b.symbol),
                  )
                  .map((p) => (
                    <PositionRowItem
                      key={p.id}
                      position={p}
                      totalMV={summary.total_market_value}
                    />
                  ))}
              </tbody>
            </table>
          </section>

          {/* 添加新持仓 */}
          <div className="mt-4">
            <AddPositionForm />
          </div>
        </>
      )}

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        说明：现价由 Finnhub 实时拉取（缓存 60s）。"日内"基于今日开盘后涨跌计算；"累计 P&L"以你填写的建仓均价为基准。本工具不计交易费、税费、汇兑、分红再投资，仅作思路记录用途，非真实交易系统。
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: number | null;
}) {
  const toneCls = tone == null ? "" : pnlClass(tone);
  return (
    <div className="card p-3">
      <p className="label-caps text-[10px]">{label}</p>
      <p className={`mt-1 mono text-xl font-bold ${toneCls}`}>{value}</p>
      <p className={`mono text-[11px] ${toneCls || "text-muted"}`}>{sub}</p>
    </div>
  );
}

function PositionRowItem({
  position,
  totalMV,
}: {
  position: EnrichedPosition;
  totalMV: number;
}) {
  const weight = totalMV > 0 && position.market_value != null ? position.market_value / totalMV : null;
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-muted">
      <td className="px-3 py-2">
        <Link
          href={`/t/${encodeURIComponent(position.symbol)}`}
          className="mono font-bold text-accent-strong hover:underline"
        >
          {position.symbol}
        </Link>
        {position.ticker_name ? (
          <span className="ml-2 text-[10px] text-muted">{position.ticker_name}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 mono text-right">{position.qty.toLocaleString("en-US")}</td>
      <td className="px-3 py-2 mono text-right">{fmtMoney(position.avg_cost)}</td>
      <td className="px-3 py-2 mono text-right">
        {position.current_price != null ? fmtMoney(position.current_price) : "—"}
      </td>
      <td className={`px-3 py-2 mono text-right ${pnlClass(position.change_today_pct ?? null)}`}>
        {fmtPctRaw(position.change_today_pct ?? null)}
      </td>
      <td className="px-3 py-2 mono text-right">
        {position.market_value != null ? fmtMoney(position.market_value) : "—"}
      </td>
      <td className={`px-3 py-2 mono text-right ${pnlClass(position.pnl_abs)}`}>
        <div>{position.pnl_abs != null ? fmtMoney(position.pnl_abs) : "—"}</div>
        <div className="text-[10px]">{fmtPct(position.pnl_pct)}</div>
      </td>
      <td className="px-3 py-2 mono text-right text-foreground-soft">
        {weight != null ? `${(weight * 100).toFixed(1)}%` : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <PositionRowActions position={position} />
      </td>
    </tr>
  );
}
