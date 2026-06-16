import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  getConversionFunnel,
  getGrowthKpi,
  getGrowthTrend,
  getRecentXPosts,
  getTopPaths,
  getUtmBreakdown,
} from "@/lib/admin-growth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Growth · OPS Alpha 运营",
  description: "DAU / 增长 / 社媒 / 流量归因",
};

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "accent" | "success";
}) {
  const cls =
    tone === "accent"
      ? "text-accent-strong"
      : tone === "success"
        ? "text-[color:var(--success)]"
        : "text-foreground";
  return (
    <div className="card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-surface-muted">
      <div className="h-full rounded bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function pct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${(n * 100).toFixed(n < 0.01 ? 2 : 1)}%`;
}

function FunnelView({
  funnel,
}: {
  funnel: { windowDays: number; stages: Array<{ key: string; label: string; count: number; stepRate: number; overallRate: number }> };
}) {
  const top = funnel.stages[0]?.count ?? 0;
  return (
    <div className="space-y-1.5">
      {funnel.stages.map((s, i) => {
        const widthPct = top > 0 ? Math.max(2, Math.round((s.count / top) * 100)) : 0;
        const isPaid = s.key === "subscription_paid";
        return (
          <div key={s.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-[11px]">
            <span className="text-muted">{s.label}</span>
            <div className="h-4 w-full overflow-hidden rounded bg-surface-muted">
              <div
                className={`flex h-full items-center justify-end rounded pr-1.5 ${isPaid ? "bg-[color:var(--success)]" : "bg-accent"}`}
                style={{ width: `${widthPct}%` }}
              >
                <span className="mono text-[10px] font-bold text-black/80">{s.count}</span>
              </div>
            </div>
            <span className="mono w-20 text-right text-foreground-soft">
              {i === 0 ? "100%" : pct(s.stepRate)}
              <span className="text-muted"> · {pct(s.overallRate)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function GrowthDashboardPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login?redirect=/admin/growth");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const [kpi, trend, topPaths, utm, recentX, funnel7d, funnel30d] = await Promise.all([
    getGrowthKpi(),
    getGrowthTrend(30),
    getTopPaths(10),
    getUtmBreakdown(),
    getRecentXPosts(8),
    getConversionFunnel(7),
    getConversionFunnel(30),
  ]);

  const maxDau = Math.max(1, ...trend.map((t) => t.dau));
  const maxPv = Math.max(1, ...trend.map((t) => t.pv));

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="label-caps">Growth Ops</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">网站运营中心</h1>
          <p className="mt-1 text-[13px] text-muted">
            用户增长 · DAU/UV · 社媒转化 · 流量归因 · X 每日 5 篇深度研报
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Link href="/admin/social" className="btn-outline px-3 py-1.5">
            社媒工作台
          </Link>
          <Link href="/admin/ops" className="btn-outline px-3 py-1.5">
            系统监控
          </Link>
          <Link href="/admin" className="text-muted hover:text-accent-strong">
            ← Admin
          </Link>
        </div>
      </header>

      {/* 运营体系概览 */}
      <section className="mb-5 card p-4">
        <h2 className="text-[12px] font-bold text-foreground">运营体系</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4 text-[12px]">
          <div className="rounded border border-border bg-surface-muted p-3">
            <p className="font-bold text-accent-strong">① 内容生产</p>
            <p className="mt-1 text-muted">AI 研报 / 快讯 cron → 英文摘要回填 → 内容库</p>
          </div>
          <div className="rounded border border-border bg-surface-muted p-3">
            <p className="font-bold text-accent-strong">② 社媒分发</p>
            <p className="mt-1 text-muted">每日 5 篇 analysis 英文长文 → X（Premium）· UTM + 短链</p>
          </div>
          <div className="rounded border border-border bg-surface-muted p-3">
            <p className="font-bold text-accent-strong">③ 流量承接</p>
            <p className="mt-1 text-muted">X 落地默认英文 · Research Pro 试用转化</p>
          </div>
          <div className="rounded border border-border bg-surface-muted p-3">
            <p className="font-bold text-accent-strong">④ 数据闭环</p>
            <p className="mt-1 text-muted">page_view 埋点 · events · 本看板复盘 DAU / 归因</p>
          </div>
        </div>
      </section>

      {/* KPI */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="DAU 24h" value={kpi.dau24h} hint="活跃主体（用户或访客）" tone="accent" />
        <Kpi label="WAU 7d" value={kpi.wau7d} hint="7 日活跃" />
        <Kpi label="MAU 30d" value={kpi.mau30d} hint="30 日活跃" />
        <Kpi label="PV 24h" value={kpi.pv24h} hint="页面浏览" />
        <Kpi label="UV 24h" value={kpi.uv24h} hint="独立访客" />
        <Kpi label="总用户" value={kpi.totalUsers} hint={`+${kpi.signups7d} / 7d`} />
        <Kpi label="注册 24h" value={kpi.signups24h} hint="新 signup" tone="success" />
        <Kpi label="阅读 24h" value={kpi.reads24h} hint="登录用户读文章" />
        <Kpi label="X 发帖 24h" value={kpi.xPosts24h} hint={`${kpi.xPosts7d} / 7d`} />
        <Kpi label="X 短链点击" value={kpi.xClicks7d} hint="累计（utm=x）" />
        <Kpi label="试用活跃" value={kpi.trialUsers} hint="subscription active" />
        <Kpi label="Research Pro" value={kpi.paidUsers} hint="付费研究权限" tone="success" />
        <Kpi label="邮箱订阅" value={kpi.emailSubs} hint={`+${kpi.emailSubs7d} / 7d`} tone="accent" />
      </section>

      {/* 转化漏斗 */}
      <section className="mb-5 card p-4">
        <h2 className="text-[12px] font-bold text-foreground">转化漏斗</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          访客 → 命中付费墙 → 看定价 → 发起结账 → 试用/付费 · 右侧：环比上一步 · 占 UV
        </p>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold text-accent-strong">近 7 天</p>
            <FunnelView funnel={funnel7d} />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold text-accent-strong">近 30 天</p>
            <FunnelView funnel={funnel30d} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 30 日趋势 */}
        <section className="card p-4">
          <h2 className="text-[12px] font-bold text-foreground">30 日趋势</h2>
          <p className="mt-0.5 text-[11px] text-muted">DAU（柱）· PV（浅柱）· 注册折线</p>
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {trend.slice(-14).map((row) => (
              <div key={row.day} className="grid grid-cols-[72px_1fr_32px] items-center gap-2 text-[11px]">
                <span className="mono text-muted">{row.day.slice(5)}</span>
                <div className="space-y-0.5">
                  <MiniBar value={row.dau} max={maxDau} />
                  <MiniBar value={row.pv} max={maxPv} />
                </div>
                <span className="mono text-right text-foreground-soft">
                  {row.dau}
                  {row.signups > 0 ? <span className="text-[color:var(--success)]"> +{row.signups}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 流量归因 */}
        <section className="card p-4">
          <h2 className="text-[12px] font-bold text-foreground">流量归因 7d</h2>
          <p className="mt-0.5 text-[11px] text-muted">page_view · utm_source</p>
          <div className="mt-3 divide-y divide-border">
            {utm.length === 0 ? (
              <p className="py-4 text-[12px] text-muted">埋点刚上线，数据将陆续积累</p>
            ) : (
              utm.map((u) => (
                <div key={u.utm_source} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-medium text-foreground">{u.utm_source}</span>
                  <span className="mono text-muted">{u.views_7d} views</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 热门路径 */}
        <section className="card p-4">
          <h2 className="text-[12px] font-bold text-foreground">热门页面 7d</h2>
          <div className="mt-3 divide-y divide-border">
            {topPaths.length === 0 ? (
              <p className="py-4 text-[12px] text-muted">暂无 page_view 数据</p>
            ) : (
              topPaths.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-2 py-2 text-[11px]">
                  <span className="truncate font-mono text-foreground-soft">{p.path}</span>
                  <span className="mono shrink-0 text-muted">{p.views_7d}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 最近 X 发帖 */}
        <section className="card p-4">
          <h2 className="text-[12px] font-bold text-foreground">最近 X 发帖</h2>
          <p className="mt-0.5 text-[11px] text-muted">自动 + 手动 · 目标 5 篇 analysis / 天</p>
          <div className="mt-3 divide-y divide-border">
            {recentX.map((p, i) => (
              <div key={`${p.ref_key}-${i}`} className="py-2">
                <p className="line-clamp-1 text-[12px] font-medium text-foreground">{p.title}</p>
                <p className="mt-0.5 mono text-[10px] text-muted">
                  {p.posted_x_at?.slice(0, 16).replace("T", " ")} · {p.ref_key ?? "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
