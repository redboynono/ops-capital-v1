import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { ProductPaywallCard } from "@/components/product-paywall-card";
import { StickyPaywall } from "@/components/sticky-paywall";
import { getSessionUser } from "@/lib/auth";
import {
  getEditionByDate,
  getLatestPublishedEdition,
  listPublishedEditionDates,
  type AiSignal,
} from "@/lib/ai-signals";
import { hasResearchAccess } from "@/lib/entitlements";
import { getDictionary, getLocale } from "@/lib/i18n";
import { logEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toFixed(2);
}

function SignalCard({
  signal,
  canViewFull,
  loggedIn,
  locale,
  labels,
}: {
  signal: AiSignal;
  canViewFull: boolean;
  loggedIn: boolean;
  locale: "zh" | "en";
  labels: {
    target: string;
    stop: string;
    entry: string;
    opsScore: string;
    unlock: string;
  };
}) {
  return (
    <article className="card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[11px] text-muted">#{signal.rank_no}</span>
            <Link href={`/t/${signal.ticker_symbol}`} className="chip font-mono font-bold">
              {signal.ticker_symbol}
            </Link>
            {signal.ops_verdict ? (
              <span className="badge-free mono text-[10px]">{signal.ops_verdict}</span>
            ) : null}
            <span
              className={`mono rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${
                signal.conviction === "high"
                  ? "border-[color:var(--success)] text-[color:var(--success)]"
                  : "border-border text-muted"
              }`}
            >
              {signal.conviction}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold leading-snug md:text-xl">{signal.headline}</h2>
          {signal.ticker_name ? (
            <p className="mt-0.5 text-[12px] text-muted">{signal.ticker_name}</p>
          ) : null}
        </div>
        <div className="text-right text-[11px] text-muted">
          <p>
            {labels.opsScore}: <span className="mono font-semibold text-foreground">{signal.ops_score?.toFixed(2) ?? "—"}</span>
          </p>
          <p className="mt-0.5">
            AI: <span className="mono font-semibold text-accent-strong">{signal.ai_score ?? "—"}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-sm border border-border bg-surface-muted p-3 text-center text-[11px]">
        <div>
          <p className="label-caps text-[10px]">{labels.entry}</p>
          <p className="mt-0.5 font-mono text-[15px] font-bold">{canViewFull ? fmtPrice(signal.entry_price) : "🔒"}</p>
        </div>
        <div>
          <p className="label-caps text-[10px]">{labels.target}</p>
          <p className="mt-0.5 font-mono text-[15px] font-bold text-[color:var(--success)]">
            {canViewFull ? fmtPrice(signal.target_price) : "🔒"}
          </p>
        </div>
        <div>
          <p className="label-caps text-[10px]">{labels.stop}</p>
          <p className="mt-0.5 font-mono text-[15px] font-bold text-[color:var(--danger)]">
            {canViewFull ? fmtPrice(signal.stop_price) : "🔒"}
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <p className="text-[14px] leading-relaxed text-foreground-soft">{signal.reason_teaser}</p>
        {canViewFull ? (
          <div className="prose prose-sm prose-invert mt-3 max-w-none whitespace-pre-wrap text-[14px] leading-relaxed">
            {signal.reason_md.replace(signal.reason_teaser, "").trim() || signal.reason_md}
          </div>
        ) : (
          <div className="relative mt-3">
            <div
              className="pointer-events-none max-h-[88px] overflow-hidden text-[14px] leading-relaxed text-foreground-soft blur-[6px] select-none"
              aria-hidden
            >
              {signal.reason_md.slice(0, 280)}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--surface)] to-transparent" />
            <div className="relative mt-2">
              <ProductPaywallCard product="research" loggedIn={loggedIn} compact />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export async function generateMetadata() {
  const locale = await getLocale();
  const s = getDictionary(locale).signals;
  return { title: s.metaTitle, description: s.metaDesc };
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const s = dict.signals;

  const [user, history] = await Promise.all([getSessionUser(), listPublishedEditionDates(12)]);

  const edition = week
    ? await getEditionByDate(week)
    : await getLatestPublishedEdition();

  if (!edition) {
    if (week) notFound();
    return (
      <div className="mx-auto max-w-[840px] px-4 py-10 md:px-6">
        <header className="border-b border-border pb-4">
          <span className="label-caps">AI Weekly</span>
          <h1 className="mt-1 text-3xl font-bold">{s.title}</h1>
          <p className="mt-2 text-[14px] text-muted">{s.subtitle}</p>
        </header>
        <div className="card mt-6 p-8 text-center">
          <p className="text-[14px] text-muted">{s.empty}</p>
          <Link href="/pricing?product=research" className="btn-primary mt-4 inline-block px-4 py-2 text-[13px]">
            {s.ctaPro}
          </Link>
        </div>
      </div>
    );
  }

  const canViewFull = hasResearchAccess(user);
  if (!canViewFull) {
    logEvent("paywall_hit", {
      userId: user?.id ?? null,
      meta: { page: "signals", edition_date: edition.edition_date, logged_in: Boolean(user) },
    });
  }

  const weekLabel = edition.edition_date.slice(0, 10);
  const labels = {
    target: s.target,
    stop: s.stop,
    entry: s.entry,
    opsScore: s.opsScore,
    unlock: s.unlock,
  };

  return (
    <div className="mx-auto w-full max-w-[840px] px-4 py-6 md:px-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-premium">Research Pro</span>
          <span className="label-caps">{s.weeklyLabel}</span>
          <span className="font-mono text-[12px] text-muted">{weekLabel}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{s.title}</h1>
        <p className="mt-2 text-[14px] text-muted">{s.subtitle}</p>
        {edition.summary_md ? (
          <p className="mt-2 text-[13px] text-foreground-soft">{edition.summary_md}</p>
        ) : null}
        {!canViewFull ? (
          <p className="mt-3 rounded-sm border border-dashed border-accent/40 bg-accent-soft/30 px-3 py-2 text-[12px] text-foreground-soft">
            {s.teaserNote}
          </p>
        ) : null}
      </header>

      {history.length > 1 ? (
        <nav className="mt-4 flex flex-wrap gap-2">
          {history.map((d) => (
            <Link
              key={d}
              href={d === weekLabel && !week ? "/signals" : `/signals?week=${d}`}
              className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${
                d === weekLabel
                  ? "border-accent bg-accent/10 text-accent-strong"
                  : "border-border text-muted hover:border-accent/50"
              }`}
            >
              {d}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-6 space-y-4">
        {edition.signals.map((sig) => (
          <SignalCard
            key={sig.id}
            signal={sig}
            canViewFull={canViewFull}
            loggedIn={Boolean(user)}
            locale={locale}
            labels={labels}
          />
        ))}
      </div>

      {!canViewFull ? <StickyPaywall loggedIn={Boolean(user)} product="research" locale={locale} /> : null}

      <div className="mt-8">
        <LegalDisclaimer variant="compact" />
        <p className="mt-2 text-[11px] text-muted-soft">{s.disclaimer}</p>
      </div>
    </div>
  );
}
