import { SubscribeButton } from "@/components/subscribe-button";

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in max-w-3xl">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">会员订阅</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground md:text-6xl">
            解锁 Ops Capital 完整的机构级投研能力。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
            摘要免费开放；会员可解锁完整的宏观与科技研究、编辑精选备忘录，并直接管理订阅与账单。
          </p>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="glass-panel rise-in rounded-3xl p-8" style={{ animationDelay: "60ms" }}>
            <p className="text-xs uppercase tracking-[0.28em] text-accent-soft/85">月付</p>
            <p className="mt-5 font-[var(--font-brand-serif)] text-5xl text-foreground">
              $50<span className="ml-1 text-base text-muted">/ 月</span>
            </p>
            <p className="mt-3 text-sm text-muted">每月自动续费，随时可在会员中心取消。</p>

            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li>• 完整付费研报库</li>
              <li>• 每周决策备忘录</li>
              <li>• 管理台支持账单</li>
            </ul>

            <div className="mt-7">
              <SubscribeButton plan="monthly" />
            </div>
          </article>

          <article
            className="rise-in rounded-3xl border border-accent/55 bg-[linear-gradient(140deg,rgba(176,139,87,0.14),rgba(15,19,27,0.85))] p-8 shadow-[0_40px_80px_-40px_rgba(176,139,87,0.35)]"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.28em] text-accent-soft">年付</p>
              <span className="rounded-full border border-accent/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-soft">
                推荐
              </span>
            </div>
            <p className="mt-5 font-[var(--font-brand-serif)] text-5xl text-foreground">
              $500<span className="ml-1 text-base text-muted">/ 年</span>
            </p>
            <p className="mt-3 text-sm text-muted">相比月付节省约 16%，适合长期跟踪策略。</p>

            <ul className="mt-6 space-y-2 text-sm text-muted">
              <li>• 包含月付全部权益</li>
              <li>• 优先研报推送</li>
              <li>• 长周期主题跟踪</li>
            </ul>

            <div className="mt-7">
              <SubscribeButton plan="yearly" />
            </div>
          </article>
        </section>

        <section className="mt-12 grid gap-4 rounded-3xl border border-border/80 bg-surface/70 p-6 md:grid-cols-3 md:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent-soft/85">治理</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              每篇研报都经编辑审校与确定性检查点。
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent-soft/85">基础设施</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              机构级技术栈：认证、支付与分发一体化。
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent-soft/85">覆盖</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              宏观周期、政策、盈利与科技结构主题。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
