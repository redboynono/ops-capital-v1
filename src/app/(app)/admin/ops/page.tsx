import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminOpsActions } from "@/components/admin-ops-actions";
import { requireAdmin } from "@/lib/admin";
import {
  getCronHealth,
  getDataFreshness,
  getEventTrends,
  getKpi,
  getRecentFailures,
  getTopAiSymbols,
  getUserFunnel,
  type CronJobHealth,
} from "@/lib/admin-ops";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ops · OPS Alpha 后台",
  description: "运行健康 / 数据新鲜度 / 用户漏斗 / 事件趋势",
};

// 各 cron 期望频率，用于"超期"染色
const JOB_EXPECTED_MAX_AGE_MIN: Record<string, number> = {
  "daily-news": 60 * 5, // 4h cron，宽限 1h
  "daily-content": 60 * 7, // 6h cron
  "daily-briefing": 60 * 26, // daily
  "check-alerts": 30, // 15min cron
  "earnings-scan": 60 * 5, // 4h cron
  "ratings-refresh": 60 * 26, // daily
};

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtAge(min: number | null): string {
  if (min == null) return "—";
  if (min < 1) return "<1m";
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ""}`;
  return `${Math.floor(min / 1440)}d`;
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtIso(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 19) + "Z";
}

function cronStatusBadge(j: CronJobHealth): { label: string; cls: string } {
  const expected = JOB_EXPECTED_MAX_AGE_MIN[j.job_name];
  const overdue = expected != null && j.age_minutes != null && j.age_minutes > expected;
  if (j.status === "running")
    return { label: "RUN", cls: "bg-accent/15 text-accent-strong" };
  if (j.status === "failed")
    return { label: "FAIL", cls: "bg-[color:var(--danger)]/15 text-[color:var(--danger)]" };
  if (j.status === "partial")
    return { label: "PART", cls: "bg-amber-500/15 text-amber-500" };
  if (overdue) return { label: "STALE", cls: "bg-amber-500/15 text-amber-500" };
  return { label: "OK", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)]" };
}

export default async function OpsDashboardPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login?redirect=/admin/ops");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  // 全部并行
  const [kpi, crons, freshness, funnel, trends, failures, topSyms] = await Promise.all([
    getKpi(),
    getCronHealth(),
    getDataFreshness(),
    getUserFunnel(),
    getEventTrends(),
    getRecentFailures(15),
    getTopAiSymbols(10),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">Ops</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">运营监控面板</h1>
          <p className="mt-1 text-[13px] text-muted">
            cron 健康 · 数据新鲜度 · 用户漏斗 · 行为趋势（基于 events / job_runs 表）
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[12px] text-muted hover:text-accent-strong"
        >
          ← 回到 Admin 首页
        </Link>
      </header>

      <AdminOpsActions />

      {/* ============= KPI ============= */}
      <section className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="DAU 24h" value={kpi.dau24h} hint="有事件的不重复用户" />
        <Kpi
          label="新增 7d"
          value={kpi.signups7d}
          hint="新注册用户"
          tone="accent"
        />
        <Kpi label="AI 问询 24h" value={kpi.aiQueries24h} />
        <Kpi label="Alert 触发 24h" value={kpi.alertTriggers24h} />
        <Kpi
          label="Cron 失败 24h"
          value={kpi.cronFailures24h}
          tone={kpi.cronFailures24h > 0 ? "danger" : "ok"}
        />
        <Kpi label="简报邮件 7d" value={kpi.briefingsSent7d} />
      </section>

      {/* ============= Cron 健康 ============= */}
      <Section title="Cron 任务健康">
        {crons.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted">
            还没有任何 job_runs 记录。等下一波 cron 触发后这里就会有数据。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">任务</th>
                  <th className="px-3 py-2 font-normal">状态</th>
                  <th className="px-3 py-2 font-normal">上次开始</th>
                  <th className="px-3 py-2 font-normal text-right">距今</th>
                  <th className="px-3 py-2 font-normal text-right">耗时</th>
                  <th className="px-3 py-2 font-normal text-right">items</th>
                  <th className="px-3 py-2 font-normal text-right">24h 跑 / 失</th>
                  <th className="px-3 py-2 font-normal">最近错误</th>
                </tr>
              </thead>
              <tbody>
                {crons.map((c) => {
                  const badge = cronStatusBadge(c);
                  return (
                    <tr
                      key={c.job_name}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-2 mono font-bold text-foreground">{c.job_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 mono text-[11px] text-foreground-soft">
                        {fmtIso(c.last_started_at)}
                      </td>
                      <td className="px-3 py-2 mono text-right text-foreground-soft">
                        {fmtAge(c.age_minutes)}
                      </td>
                      <td className="px-3 py-2 mono text-right text-foreground-soft">
                        {fmtDuration(c.duration_ms)}
                      </td>
                      <td className="px-3 py-2 mono text-right text-foreground-soft">
                        {c.items_total != null
                          ? `${c.items_ok ?? 0}/${c.items_total}${
                              (c.items_failed ?? 0) > 0
                                ? ` (${c.items_failed} 失)`
                                : ""
                            }`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 mono text-right text-[11px]">
                        <span className="text-foreground-soft">{c.runs_24h}</span>
                        {c.fails_24h > 0 ? (
                          <span className="ml-1 text-[color:var(--danger)]">
                            / {c.fails_24h}
                          </span>
                        ) : (
                          <span className="ml-1 text-muted">/ 0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-muted">
                        <span className="line-clamp-1" title={c.error_message ?? ""}>
                          {c.error_message ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ============= 数据健康 + 用户漏斗 ============= */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="数据健康">
          <div className="space-y-3 px-3 py-3 text-[12px]">
            <Row label="Tickers 覆盖" value={
              <>
                <span className="font-bold text-foreground">{freshness.tickers.with_rating}</span>
                <span className="text-muted"> / {freshness.tickers.total}</span>
                <span className="ml-2 text-foreground-soft">({fmtPct(freshness.tickers.coverage_pct)})</span>
              </>
            } />
            <Row label="Rating 24h 内刷新" value={
              <span className="font-bold text-foreground">{freshness.ratings.updated_24h}</span>
            } />
            <Row label="Posts 总数" value={
              <>
                <span className="font-bold text-foreground">{freshness.posts.total}</span>
                <span className="ml-2 text-muted">最新 {fmtIso(freshness.posts.latest_at)}</span>
              </>
            } />
            <Row label="Posts 24h / 7d" value={
              <>
                <span className="font-bold text-foreground">{freshness.posts.last24h}</span>
                <span className="text-muted"> / {freshness.posts.last7d}</span>
              </>
            } />
            <Row label="Earnings 总入库" value={
              <span className="font-bold text-foreground">{freshness.earnings.total}</span>
            } />
            <Row label="未来 30d 财报" value={
              <span className="font-bold text-foreground">{freshness.earnings.future30d}</span>
            } />
            <Row label="已发但缺文章" value={
              freshness.earnings.reported_no_post > 0 ? (
                <span className="font-bold text-[color:var(--danger)]">
                  {freshness.earnings.reported_no_post}
                </span>
              ) : (
                <span className="text-foreground-soft">0</span>
              )
            } />
          </div>
        </Section>

        <Section title="用户漏斗">
          <div className="space-y-2 px-3 py-3 text-[12px]">
            <FunnelRow label="注册用户" value={funnel.total_users} pctOf={funnel.total_users} />
            <FunnelRow label="有自选" value={funnel.has_watchlist} pctOf={funnel.total_users} />
            <FunnelRow label="有持仓" value={funnel.has_position} pctOf={funnel.total_users} />
            <FunnelRow label="有 Alert" value={funnel.has_alert} pctOf={funnel.total_users} />
            <FunnelRow label="订阅简报邮件" value={funnel.briefing_enabled} pctOf={funnel.total_users} />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
              <div>
                <p className="text-muted">30d 新增</p>
                <p className="mono font-bold text-foreground">{funnel.signups_30d}</p>
              </div>
              <div>
                <p className="text-muted">7d 活跃 DAU</p>
                <p className="mono font-bold text-foreground">{funnel.active_dau_7d}</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ============= 事件趋势 + 热门标的 ============= */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="事件类型（24h / 7d）">
          {trends.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-muted">还没有事件埋点数据</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">事件类型</th>
                  <th className="px-3 py-2 font-normal text-right">24h</th>
                  <th className="px-3 py-2 font-normal text-right">7d</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t) => (
                  <tr key={t.event_type} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-1.5 mono">{t.event_type}</td>
                    <td className="px-3 py-1.5 mono text-right">{t.count_24h}</td>
                    <td className="px-3 py-1.5 mono text-right text-foreground-soft">
                      {t.count_7d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="AI 问询最多的标的（7d）">
          {topSyms.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-muted">还没有 AI 问询事件</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">代码</th>
                  <th className="px-3 py-2 font-normal text-right">问询次数</th>
                </tr>
              </thead>
              <tbody>
                {topSyms.map((s) => (
                  <tr key={s.symbol} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/t/${encodeURIComponent(s.symbol)}`}
                        className="mono font-bold text-accent-strong hover:underline"
                      >
                        {s.symbol}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 mono text-right">{s.queries_7d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      {/* ============= 最近失败 ============= */}
      <Section title="最近 15 次失败任务">
        {failures.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-[color:var(--success)]">✓ 暂无失败记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">时间</th>
                  <th className="px-3 py-2 font-normal">任务</th>
                  <th className="px-3 py-2 font-normal text-right">耗时</th>
                  <th className="px-3 py-2 font-normal">错误信息</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 mono text-[11px] text-foreground-soft">
                      {fmtIso(f.started_at)}
                    </td>
                    <td className="px-3 py-2 mono">{f.job_name}</td>
                    <td className="px-3 py-2 mono text-right text-foreground-soft">
                      {fmtDuration(f.duration_ms)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[color:var(--danger)]">
                      <span className="line-clamp-2" title={f.error_message ?? ""}>
                        {f.error_message ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="mt-6 border-t border-border pt-3 text-[11px] text-muted-soft">
        基础设施：MySQL 8 · Next.js standalone · Caddy 反向代理 · 7 个 cron。
        所有 cron 通过 runJob() helper 写入 <code>job_runs</code>；用户路径通过{" "}
        <code>logEvent()</code> 写入 <code>events</code>。当前请求时间 ·{" "}
        {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC
      </p>
    </div>
  );
}

// ============ 小组件 ============

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-4">
      <header className="border-b border-border px-3 py-2">
        <h2 className="text-[12px] font-bold text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "accent" | "danger" | "ok";
}) {
  const valueClass =
    tone === "accent"
      ? "text-accent-strong"
      : tone === "danger"
        ? "text-[color:var(--danger)]"
        : tone === "ok"
          ? "text-[color:var(--success)]"
          : "text-foreground";
  return (
    <div className="card p-3">
      <p className="label-caps text-[9px]">{label}</p>
      <p className={`mt-1 mono text-2xl font-bold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="mono text-right">{value}</span>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  pctOf,
}: {
  label: string;
  value: number;
  pctOf: number;
}) {
  const pct = pctOf > 0 ? (value / pctOf) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="mono">
          <span className="font-bold text-foreground">{value}</span>
          <span className="ml-2 text-[10px] text-muted">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full bg-[color:var(--accent)]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
