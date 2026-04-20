import Link from "next/link";

export default function Home() {
  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(176,139,87,0.16),transparent_35%)]" />

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">Ops Capital · 机构级投研平台</p>
            <h1 className="mt-5 max-w-3xl font-[var(--font-brand-serif)] text-5xl leading-[1.04] text-foreground md:text-7xl">
              机构级投研引擎，
              <span className="block text-accent-soft">为统一决策而生。</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
              Ops Capital 对标世界级机构投研体验：多因子宏观框架、AI 增强的深度综合，
              以及面向专业团队的发布工作流，拉齐一线投资所标准。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/reports" className="primary-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
                浏览研报
              </Link>
              <Link href="/pricing" className="ghost-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
                查看订阅方案
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 md:p-7">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-soft/80">运营快照</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/80 bg-surface/65 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">覆盖范围</p>
                <p className="mt-3 font-[var(--font-brand-serif)] text-3xl text-accent-soft">38</p>
                <p className="mt-1 text-xs text-muted">宏观 + 科技主题</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-surface/65 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">周产出</p>
                <p className="mt-3 font-[var(--font-brand-serif)] text-3xl text-accent-soft">12</p>
                <p className="mt-1 text-xs text-muted">决策备忘录</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-surface/65 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">交付时长</p>
                <p className="mt-3 font-[var(--font-brand-serif)] text-3xl text-accent-soft">&lt;10m</p>
                <p className="mt-1 text-xs text-muted">从草稿到发布</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-surface/65 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">信号引擎</p>
                <p className="mt-3 font-[var(--font-brand-serif)] text-3xl text-accent-soft">V1</p>
                <p className="mt-1 text-xs text-muted">对齐 CIO 工作流</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          <article className="glass-panel rise-in rounded-2xl p-6" style={{ animationDelay: "60ms" }}>
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">研究平台</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground">从宏观到公司的叙事</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              将市场周期转化为可解释的投资逻辑，流动性、政策、盈利与科技结构转变层层叠加，
              输出一致的行动框架。
            </p>
          </article>

          <article className="glass-panel rise-in rounded-2xl p-6" style={{ animationDelay: "120ms" }}>
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">编辑引擎</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground">人机协同的编辑闭环</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              每一篇 AI 草稿都要经编辑审校与确定性检查点，兼具认知效率与治理约束。
            </p>
          </article>

          <article className="glass-panel rise-in rounded-2xl p-6" style={{ animationDelay: "180ms" }}>
            <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">会员平台</p>
            <h2 className="mt-4 font-[var(--font-brand-serif)] text-2xl text-foreground">有价值的研报分发</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              从认证、订阅到支付、权限控制，机构级的会员运营能力一次性集成在平台内。
            </p>
          </article>
        </section>

        <section className="mt-14 rounded-3xl border border-border/90 bg-surface/70 p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-accent-soft/85">上线你的投研桌</p>
              <h3 className="mt-3 max-w-3xl font-[var(--font-brand-serif)] text-4xl text-foreground md:text-5xl">
                把碎散的分析，重新整合成一个决策系统。
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
                Ops Capital 将结构化生成、编辑精准与分发治理融为一体，让团队从第一天起就拥有
                现代宏观机构级别的运转能力。
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/admin/editor" className="primary-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
                打开编辑器
              </Link>
              <Link href="/admin" className="ghost-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
                进入后台
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
