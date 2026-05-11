import Link from "next/link";

import { listEarningsCalendar, type EarningsCalendarRow } from "@/lib/earnings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "财报日历 · OPS Alpha",
  description: "覆盖所有 Ops Alpha 标的的财报发布时间表，已发的自动生成 AI 解读文章。",
};

const HOUR_LABEL: Record<string, string> = {
  bmo: "盘前",
  amc: "盘后",
  dmh: "盘中",
};

function fmtDate(d: string): string {
  // YYYY-MM-DD → MM/DD（周X）
  const date = new Date(d + "T12:00:00Z");
  const md = `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getUTCDay()];
  return `${md} ${week}`;
}

function fmtRev(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function epsSurpriseTone(actual: number | null, est: number | null) {
  if (actual == null || est == null) return null;
  const diff = actual - est;
  if (Math.abs(diff) < 1e-9) return null;
  return diff > 0 ? "beat" : "miss";
}

/** 计算从 anchor 起 ±delta 天的 ISO 区间。 */
function isoOffset(anchor: Date, deltaDays: number): string {
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** 把 calendar rows 按 status / date 分组。 */
function bucket(rows: EarningsCalendarRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const released: EarningsCalendarRow[] = [];
  const upcoming: EarningsCalendarRow[] = [];
  for (const r of rows) {
    if (r.eps_actual != null) released.push(r);
    else if (r.report_date >= today) upcoming.push(r);
    else released.push(r); // 历史日期但没数据，归入"已发"区
  }
  return { released, upcoming, today };
}

function StatusBadge({ row, today }: { row: EarningsCalendarRow; today: string }) {
  if (row.eps_actual != null) {
    const tone = epsSurpriseTone(row.eps_actual, row.eps_estimate);
    if (tone === "beat")
      return (
        <span className="rounded-sm bg-[color:var(--success)]/15 px-1.5 py-0.5 mono text-[10px] font-bold text-[color:var(--success)]">
          BEAT
        </span>
      );
    if (tone === "miss")
      return (
        <span className="rounded-sm bg-[color:var(--danger)]/15 px-1.5 py-0.5 mono text-[10px] font-bold text-[color:var(--danger)]">
          MISS
        </span>
      );
    return (
      <span className="rounded-sm border border-border px-1.5 py-0.5 mono text-[10px] text-foreground-soft">
        REPORTED
      </span>
    );
  }
  if (row.report_date === today) {
    return (
      <span className="rounded-sm bg-accent/20 px-1.5 py-0.5 mono text-[10px] font-bold text-accent-strong">
        TODAY
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-dashed border-foreground-soft px-1.5 py-0.5 mono text-[10px] text-foreground-soft">
      待发布
    </span>
  );
}

function EarningsRowItem({ row, today }: { row: EarningsCalendarRow; today: string }) {
  const surprise =
    row.eps_actual != null && row.eps_estimate != null
      ? row.eps_actual - row.eps_estimate
      : null;
  return (
    <li className="row-hover flex flex-wrap items-center gap-3 px-3 py-2.5 text-[12px]">
      {/* date */}
      <span className="w-[88px] shrink-0 mono text-foreground-soft">{fmtDate(row.report_date)}</span>

      {/* hour */}
      <span className="w-[36px] shrink-0 mono text-[10px] text-muted">
        {row.hour ? HOUR_LABEL[row.hour] ?? row.hour.toUpperCase() : "—"}
      </span>

      {/* status */}
      <span className="w-[64px] shrink-0">
        <StatusBadge row={row} today={today} />
      </span>

      {/* symbol + name */}
      <span className="flex w-[160px] shrink-0 items-baseline gap-2">
        <Link
          href={`/t/${encodeURIComponent(row.symbol)}`}
          className="mono font-bold text-accent-strong hover:underline"
        >
          {row.symbol}
        </Link>
        <span className="truncate text-[11px] text-muted">{row.ticker_name ?? ""}</span>
      </span>

      {/* fiscal */}
      <span className="w-[56px] shrink-0 mono text-[10px] text-muted">
        FY{row.fiscal_year} Q{row.fiscal_quarter}
      </span>

      {/* EPS */}
      <span className="w-[160px] shrink-0 mono text-[11px]">
        EPS{" "}
        <span className="text-foreground">
          {row.eps_actual != null ? row.eps_actual.toFixed(2) : "—"}
        </span>
        <span className="text-muted">
          {" / "}
          est {row.eps_estimate != null ? row.eps_estimate.toFixed(2) : "—"}
        </span>
        {surprise != null ? (
          <span
            className={`ml-1 ${surprise >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}
          >
            {surprise >= 0 ? "+" : ""}
            {surprise.toFixed(2)}
          </span>
        ) : null}
      </span>

      {/* Revenue */}
      <span className="hidden w-[180px] shrink-0 mono text-[11px] md:inline">
        REV <span className="text-foreground">{fmtRev(row.revenue_actual)}</span>
        <span className="text-muted"> / est {fmtRev(row.revenue_estimate)}</span>
      </span>

      {/* article link */}
      <span className="ml-auto">
        {row.post_slug ? (
          <Link
            href={`/${row.post_kind === "news" ? "news" : "analysis"}/${row.post_slug}`}
            className="text-[11px] text-accent-strong hover:underline"
          >
            阅读 AI 解读 →
          </Link>
        ) : null}
      </span>
    </li>
  );
}

export default async function EarningsCalendarPage() {
  const today = new Date();
  const fromISO = isoOffset(today, -14);
  const toISO = isoOffset(today, 30);

  const rows = await listEarningsCalendar(fromISO, toISO);
  const { released, upcoming, today: todayISO } = bucket(rows);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Earnings</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">财报日历</h1>
        <p className="mt-1 text-[13px] text-muted">
          覆盖所有 OPS Alpha 标的 · 过去 14 天 + 未来 30 天 · 已发财报自动生成 AI 解读
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card py-10 text-center text-[13px] text-muted">
          当前窗口内没有财报记录
        </div>
      ) : (
        <>
          {/* Upcoming */}
          <section className="mb-6">
            <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-bold text-foreground-soft">
              即将发布
              <span className="font-normal text-muted">· {upcoming.length}</span>
            </h2>
            <div className="card overflow-x-auto">
              {upcoming.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-muted">未来 30 天内暂无财报</p>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((r) => (
                    <EarningsRowItem key={r.id} row={r} today={todayISO} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Released */}
          <section>
            <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-bold text-foreground-soft">
              近期已发
              <span className="font-normal text-muted">· {released.length}</span>
            </h2>
            <div className="card overflow-x-auto">
              {released.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-muted">过去 14 天内无财报</p>
              ) : (
                <ul className="divide-y divide-border">
                  {released
                    .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
                    .map((r) => (
                      <EarningsRowItem key={r.id} row={r} today={todayISO} />
                    ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        数据来源：Finnhub earnings calendar，每 4 小时由 cron 同步入库。BEAT/MISS 标签基于 EPS 实绩 vs 一致预期；REV 为完整财报营收。
      </p>
    </div>
  );
}
