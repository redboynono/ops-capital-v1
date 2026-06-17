import Link from "next/link";
import { redirect } from "next/navigation";

import { AddPositionForm, PositionRowActions } from "@/components/position-editor";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { getPortfolioSummary, type EnrichedPosition } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

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

  const locale = await getLocale();
  const p = getDictionary(locale).memberPages.portfolio;
  const summary = await getPortfolioSummary(user.id);
  const positions = summary.positions;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{p.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{p.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{p.subtitle}</p>
      </header>

      {positions.length === 0 ? (
        <div className="card mb-4 px-4 py-12 text-center text-[13px] text-muted">
          <p className="mb-2 text-[16px] font-semibold text-foreground">{p.emptyTitle}</p>
          <p className="mb-4">{p.emptyBody}</p>
          <div className="inline-block">
            <AddPositionForm />
          </div>
        </div>
      ) : (
        <>
          <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label={p.totalValue}
              value={fmtMoney(summary.total_market_value)}
              sub={fmt(p.costFmt, { price: fmtMoney(summary.total_cost_basis) })}
            />
            <SummaryTile
              label={p.totalPnl}
              value={fmtMoney(summary.total_pnl_abs)}
              sub={fmtPct(summary.total_pnl_pct)}
              tone={summary.total_pnl_abs}
            />
            <SummaryTile
              label={p.dayPnl}
              value={fmtMoney(summary.day_pnl_abs)}
              sub={fmtPct(summary.day_pnl_pct)}
              tone={summary.day_pnl_abs}
            />
            <SummaryTile
              label={p.positionCount}
              value={String(positions.length)}
              sub={
                summary.unpriced_count > 0
                  ? fmt(p.unpricedFmt, { n: summary.unpriced_count })
                  : p.allPriced
              }
            />
          </section>

          <section className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">{p.colSymbol}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colQty}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colAvg}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colPrice}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colIntraday}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colValue}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colPnl}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colWeight}</th>
                  <th className="px-3 py-2 font-normal text-right">{p.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .sort(
                    (a, b) =>
                      (b.market_value ?? 0) - (a.market_value ?? 0) ||
                      a.symbol.localeCompare(b.symbol),
                  )
                  .map((pos) => (
                    <PositionRowItem
                      key={pos.id}
                      position={pos}
                      totalMV={summary.total_market_value}
                    />
                  ))}
              </tbody>
            </table>
          </section>

          <div className="mt-4">
            <AddPositionForm />
          </div>
        </>
      )}

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        {p.disclaimer}
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
