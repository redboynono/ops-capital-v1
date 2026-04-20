import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { PortalButton } from "@/components/portal-button";

export default async function DashboardPage() {
  const user = await getSessionUser();

  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in flex flex-col gap-6 border-b border-border/70 pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">会员桌面</p>
            <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground md:text-6xl">
              欢迎回来。
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">当前登录：{user?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PortalButton />
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <Link
            href="/dashboard/profile"
            className="glass-panel rise-in group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
            style={{ animationDelay: "60ms" }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">个人信息</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground group-hover:text-accent-soft">
              账户详情
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">更新姓名、查看账户基本信息。</p>
          </Link>

          <Link
            href="/pricing"
            className="glass-panel rise-in group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
            style={{ animationDelay: "120ms" }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">订阅</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground group-hover:text-accent-soft">
              方案与账单
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">管理订阅等级与升级路径。</p>
          </Link>

          <Link
            href="/admin/editor"
            className="glass-panel rise-in group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
            style={{ animationDelay: "180ms" }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">AI 编辑器</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground group-hover:text-accent-soft">
              研报生成
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">生成并编辑机构级投研稿。</p>
          </Link>

          <Link
            href="/reports"
            className="glass-panel rise-in group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
            style={{ animationDelay: "240ms" }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">研报</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground group-hover:text-accent-soft">
              研报库
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">查看公开与付费研报。</p>
          </Link>
        </section>
      </div>
    </div>
  );
}
