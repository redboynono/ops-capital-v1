import Link from "next/link";
import { TrackRecordBar } from "@/components/track-record-bar";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { getSessionUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { logEvent } from "@/lib/observability";
import { TRIAL_DAYS } from "@/lib/payments/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "OPS Alpha · AI Research Terminal",
    description:
      "Verifiable OPS Picks track record, Chokepoint Brief from $2.99/mo, and Research Pro with a free trial.",
  };
}

export default async function StartLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string; utm_campaign?: string; lang?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en" || sp.lang === "en";
  const user = await getSessionUser();

  logEvent("start_landing_view", {
    userId: user?.id ?? null,
    meta: {
      utm_source: sp.utm_source ?? null,
      utm_campaign: sp.utm_campaign ?? null,
      logged_in: Boolean(user),
    },
  });

  const t = {
    label: "OPS Alpha",
    title: en
      ? "AI supply-chain research you can verify"
      : "可验证的 AI 供应链投研终端",
    sub: en
      ? "OPS Picks with entry prices · Chokepoint deep dives · Research Pro terminal"
      : "OPS 精选可跟单 · Chokepoint 卡点深度 · Research Pro 投研工作台",
    picksTitle: en ? "OPS Picks" : "OPS 精选",
    picksBody: en
      ? "Actionable calls with entry, target, stop, and live P&L."
      : "明确入场价、目标价、止损与实时收益。",
    picksCta: en ? "View track record →" : "查看战绩 →",
    briefTitle: "Chokepoint Brief",
    briefPrice: en ? "$2.99/mo" : "$2.99/月",
    briefBody: en
      ? "Full chokepoint franchise reports + L0–L5 supply-chain framework."
      : "全部 chokepoint 卡点研报全文 + 六层价值链框架。",
    briefCta: en ? "Start Brief →" : "订阅 Brief →",
    researchTitle: "Research Pro",
    researchBody: en
      ? `Full research, OPS Picks thesis, Ask AI, and daily briefing. ${TRIAL_DAYS}-day free trial for new subscribers.`
      : `深度研报全文、精选逻辑、Ask AI、每日简报。新用户 ${TRIAL_DAYS} 天免费试用。`,
    researchCta: en ? "Start free trial →" : "开始试用 →",
    terminalTitle: en ? "Explore the terminal" : "浏览终端",
    terminalBody: en
      ? "Market snapshot, quant top picks, rating changes, and latest research — no login required."
      : "市场快照、量化榜单、评级变动、最新研报 — 无需登录即可浏览。",
    terminalCta: en ? "Open Alpha demo →" : "打开 Alpha 演示 →",
    signup: en ? "Sign up free" : "免费注册",
    login: en ? "Log in" : "登录",
    pricing: en ? "Compare plans" : "对比方案",
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8 md:px-6">
      <header className="mb-6 border-b border-border pb-4">
        <span className="label-caps">{t.label}</span>
        <h1 className="mt-1 text-3xl font-bold leading-tight text-foreground md:text-4xl">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">{t.sub}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user ? (
            <Link href="/alpha" className="btn-primary px-4 py-2 text-[13px]">
              {t.terminalCta.replace(" →", "")}
            </Link>
          ) : (
            <>
              <Link href="/login?tab=signup&redirect=/alpha" className="btn-primary px-4 py-2 text-[13px]">
                {t.signup}
              </Link>
              <Link href="/login?redirect=/alpha" className="btn-outline px-4 py-2 text-[13px]">
                {t.login}
              </Link>
            </>
          )}
          <Link href="/pricing" className="btn-outline px-4 py-2 text-[13px]">
            {t.pricing}
          </Link>
        </div>
      </header>

      <TrackRecordBar />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="card p-4">
          <p className="label-caps text-accent-strong">{t.picksTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.picksBody}</p>
          <Link href="/picks" className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline">
            {t.picksCta}
          </Link>
        </article>
        <article className="card border-accent/40 p-4">
          <p className="label-caps text-accent-strong">{t.briefTitle}</p>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">{t.briefPrice}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.briefBody}</p>
          <Link
            href="/pricing?product=brief"
            className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline"
          >
            {t.briefCta}
          </Link>
        </article>
        <article className="card p-4">
          <p className="label-caps text-accent-strong">{t.researchTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.researchBody}</p>
          <Link
            href="/pricing?product=research"
            className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline"
          >
            {t.researchCta}
          </Link>
        </article>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="text-[15px] font-bold text-foreground">{t.terminalTitle}</h2>
        <p className="mt-1 text-[13px] text-muted">{t.terminalBody}</p>
        <Link href="/alpha" className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline">
          {t.terminalCta}
        </Link>
      </section>

      <section className="mt-6">
        <LegalDisclaimer variant="compact" />
      </section>
    </div>
  );
}
