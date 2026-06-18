import Link from "next/link";
import { TrackRecordBar } from "@/components/track-record-bar";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { getSessionUser } from "@/lib/auth";
import { getLatestPublishedEdition } from "@/lib/ai-signals";
import { getLocale } from "@/lib/i18n";
import { logEvent } from "@/lib/observability";
import { TRIAL_DAYS } from "@/lib/payments/plans";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "OPS Alpha · AI Research Terminal",
    description:
      "Verifiable OPS Picks track record, AI Weekly Signals, Chokepoint Brief from $2.99/mo, and Research Pro with a free trial.",
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
  const [user, latestSignals] = await Promise.all([
    getSessionUser(),
    getLatestPublishedEdition().catch(() => null),
  ]);

  logEvent("start_landing_view", {
    userId: user?.id ?? null,
    meta: {
      utm_source: sp.utm_source ?? null,
      utm_campaign: sp.utm_campaign ?? null,
      logged_in: Boolean(user),
    },
  });

  const signalCount = latestSignals?.signals.length ?? 0;
  const signalWeek = latestSignals?.edition_date.slice(0, 10) ?? null;
  const signalTickers = latestSignals?.signals.slice(0, 3).map((s) => s.ticker_symbol).join(", ") ?? "";

  const t = {
    label: "OPS Alpha",
    title: en
      ? "AI supply-chain research you can verify"
      : "可验证的 AI 供应链投研终端",
    sub: en
      ? "OPS Picks · AI Weekly Signals · Chokepoint Brief · Research Pro terminal"
      : "OPS 精选 · AI 周选 · Chokepoint 卡点 · Research Pro 投研工作台",
    picksTitle: en ? "OPS Picks" : "OPS 精选",
    picksBody: en
      ? "Actionable calls with entry, target, stop, and live P&L."
      : "明确入场价、目标价、止损与实时收益。",
    picksCta: en ? "View track record →" : "查看战绩 →",
    signalsTitle: en ? "AI Weekly Signals" : "AI 周选",
    signalsBadge: en ? "Research Pro" : "Research Pro 专属",
    signalsBody: en
      ? signalCount > 0
        ? `Quant-screened + AI thesis · ${signalCount} names this week${signalTickers ? ` (${signalTickers}…)` : ""}.`
        : "Quant-screened ideas with AI reasoning — updated every Monday."
      : signalCount > 0
        ? `量化预筛 + AI 深度理由 · 本周 ${signalCount} 只${signalTickers ? `（${signalTickers}…）` : ""}。`
        : "OPS 量化预筛 + AI 深度理由 · 每周一更新。",
    signalsCta: en ? "Preview this week →" : "预览本周周选 →",
    briefTitle: "Chokepoint Brief",
    briefPrice: en ? "$2.99/mo" : "$2.99/月",
    briefBody: en
      ? "Full chokepoint franchise reports + L0–L5 supply-chain framework."
      : "全部 chokepoint 卡点研报全文 + 六层价值链框架。",
    briefCta: en ? "Start Brief →" : "订阅 Brief →",
    researchTitle: "Research Pro",
    researchBody: en
      ? `Full research, OPS Picks thesis, AI Weekly, Ask AI, and daily briefing. ${TRIAL_DAYS}-day free trial.`
      : `深度研报、精选逻辑、AI 周选、Ask AI、每日简报。新用户 ${TRIAL_DAYS} 天免费试用。`,
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

  const signalsHref = signalWeek ? `/signals?week=${signalWeek}&utm_source=start` : "/signals?utm_source=start";

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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="card p-4">
          <p className="label-caps text-accent-strong">{t.picksTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.picksBody}</p>
          <Link href="/picks?utm_source=start" className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline">
            {t.picksCta}
          </Link>
        </article>
        <article className="card border-accent/50 bg-accent-soft/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="label-caps text-accent-strong">{t.signalsTitle}</p>
            <span className="badge-premium text-[10px]">{t.signalsBadge}</span>
            {signalWeek ? (
              <span className="font-mono text-[10px] text-muted">{signalWeek}</span>
            ) : null}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.signalsBody}</p>
          <Link href={signalsHref} className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline">
            {t.signalsCta}
          </Link>
        </article>
        <article className="card border-accent/40 p-4">
          <p className="label-caps text-accent-strong">{t.briefTitle}</p>
          <p className="mt-1 font-mono text-xl font-bold text-foreground">{t.briefPrice}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.briefBody}</p>
          <Link
            href="/pricing?product=brief&utm_source=start"
            className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline"
          >
            {t.briefCta}
          </Link>
        </article>
        <article className="card p-4">
          <p className="label-caps text-accent-strong">{t.researchTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.researchBody}</p>
          <Link
            href="/pricing?product=research&utm_source=start"
            className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline"
          >
            {t.researchCta}
          </Link>
        </article>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="text-[15px] font-bold text-foreground">{t.terminalTitle}</h2>
        <p className="mt-1 text-[13px] text-muted">{t.terminalBody}</p>
        <Link href="/alpha?utm_source=start" className="mt-3 inline-block text-[13px] font-semibold text-accent-strong hover:underline">
          {t.terminalCta}
        </Link>
      </section>

      <section className="mt-6">
        <LegalDisclaimer variant="compact" />
      </section>
    </div>
  );
}
