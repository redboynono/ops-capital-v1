import { getSessionUser } from "@/lib/auth";

export default async function DashboardProfilePage() {
  const user = await getSessionUser();

  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(176,139,87,0.12),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">个人信息</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground md:text-6xl">
            账户详情
          </h1>
        </section>

        <div className="glass-panel rise-in mt-8 rounded-3xl p-6 md:p-7" style={{ animationDelay: "80ms" }}>
          <dl className="divide-y divide-border/70 text-sm">
            <div className="flex items-center justify-between gap-3 py-4">
              <dt className="text-xs uppercase tracking-[0.22em] text-muted">邮箱</dt>
              <dd className="text-foreground">{user?.email ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-4">
              <dt className="text-xs uppercase tracking-[0.22em] text-muted">姓名</dt>
              <dd className="text-foreground">{user?.fullName ?? "未设置"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-4">
              <dt className="text-xs uppercase tracking-[0.22em] text-muted">订阅状态</dt>
              <dd className="text-accent-soft">{user?.subscriptionStatus ?? "inactive"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
