import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButton } from "@/components/share/share-button";
import { StickyPaywall } from "@/components/sticky-paywall";
import { ProductPaywallCard } from "@/components/product-paywall-card";
import { ReaderModeShell, ReaderPrefsProvider, ReaderPrefsToolbar } from "@/components/reader-prefs";
import { plainTeaser } from "@/lib/content-preview";
import { hasResearchAccess } from "@/lib/entitlements";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { computePerformance, getPickBySlug } from "@/lib/picks";

export const dynamic = "force-dynamic";

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toISOString().slice(0, 10);
}

function returnClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted";
  if (pct > 0) return "text-[color:var(--success)]";
  if (pct < 0) return "text-[color:var(--danger)]";
  return "text-foreground-soft";
}

export default async function PickDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reader?: string }>;
}) {
  const { slug } = await params;
  const { reader } = await searchParams;
  const readerMode = reader !== "0";

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const d = dict.picks.detail;
  const conv = dict.picks.conviction;

  const pick = await getPickBySlug(slug);
  if (!pick || !pick.is_published) notFound();

  const [user, perf] = await Promise.all([getSessionUser(), computePerformance(pick)]);

  const canViewFull = !pick.is_premium || hasResearchAccess(user);
  const toggleHref = readerMode ? `/picks/${pick.slug}?reader=0` : `/picks/${pick.slug}`;

  const statusLabel =
    pick.status === "open"
      ? d.statusOpen
      : pick.status === "closed"
        ? d.statusClosed
        : d.statusStopped;
  const statusCls =
    pick.status === "open"
      ? "text-[color:var(--success)] border-[color:var(--success)]"
      : pick.status === "stopped"
        ? "text-[color:var(--danger)] border-[color:var(--danger)]"
        : "text-muted border-border";

  const headlinePct = pick.status === "open" ? perf.unrealizedPct : perf.realizedPct;
  const convictionLabel =
    pick.conviction === "high" ? conv.high : pick.conviction === "low" ? conv.low : conv.medium;

  return (
    <ReaderPrefsProvider enabled={readerMode}>
    <div className="mx-auto w-full max-w-[880px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/picks" className="hover:text-accent-strong">{d.breadcrumb}</Link>
          <span className="mx-1">/</span>
          <span className="font-mono">{pick.ticker_symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <ReaderPrefsToolbar />
          <ShareButton
            variant="button"
            data={{
              type: "pick",
              symbol: pick.ticker_symbol,
              title: pick.title,
              subtitle: pick.subtitle,
              conviction: pick.conviction,
              status: pick.status,
              unrealizedPct: perf.unrealizedPct,
              realizedPct: perf.realizedPct,
              entryPrice: pick.entry_price,
              entryDate: new Date(pick.entry_date).toISOString().slice(0, 10),
              targetPrice: pick.target_price,
              stopPrice: pick.stop_price,
              currentPrice: perf.currentPrice,
              thesisMd: canViewFull ? pick.thesis_md : null,
              catalystsMd: canViewFull ? pick.catalysts_md : null,
              risksMd: canViewFull ? pick.risks_md : null,
            }}
            urlPath={`/picks/${pick.slug}`}
            fileNamePrefix={`ops_picks_${pick.ticker_symbol}`}
          />
          <Link
            href={toggleHref}
            className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
          >
            {readerMode ? d.readerTerminal : d.readerReading}
          </Link>
        </div>
      </nav>

      <ReaderModeShell>
        <header className={readerMode ? "border-b border-[#d8d0c2] pb-4" : "border-b border-border pb-4"}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mono rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
              {statusLabel}
            </span>
            <Link href={`/t/${pick.ticker_symbol}`} className="chip font-mono">
              {pick.ticker_symbol}
            </Link>
            {pick.is_premium ? <span className="badge-premium">PRO</span> : <span className="badge-free">{d.public}</span>}
            <span className="label-caps">{fmtDate(pick.entry_date)}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{pick.title}</h1>
          {pick.subtitle ? <p className="mt-1 text-[14px] text-muted">{pick.subtitle}</p> : null}

          <div className={`mt-4 grid grid-cols-2 gap-3 rounded-sm border p-3 md:grid-cols-5 ${readerMode ? "border-[#d8d0c2] bg-[#efe8dc]" : "border-border bg-surface-muted"}`}>
            <div>
              <p className="label-caps text-[10px]">{d.entryPrice}</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">{fmtPrice(pick.entry_price)}</p>
              <p className="font-mono text-[10px] text-muted">{fmtDate(pick.entry_date)}</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">{pick.status === "open" ? d.currentPrice : d.closePrice}</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">{fmtPrice(perf.currentPrice)}</p>
              <p className="font-mono text-[10px] text-muted">{fmt(d.heldFmt, { n: perf.daysHeld })}</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">{d.return}</p>
              <p className={`mt-0.5 font-mono text-[17px] font-bold ${returnClass(headlinePct)}`}>
                {fmtPct(headlinePct)}
              </p>
              <p className="font-mono text-[10px] text-muted">
                {pick.status === "open" ? d.unrealized : d.realized}
              </p>
            </div>
            <div>
              <p className="label-caps text-[10px]">{d.targetPrice}</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">
                {canViewFull ? fmtPrice(pick.target_price) : "🔒 Pro"}
              </p>
              <p className="font-mono text-[10px] text-muted">{fmt(d.horizonFmt, { n: pick.horizon_months })}</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">{d.stop}</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold text-[color:var(--danger)]">
                {canViewFull ? fmtPrice(pick.stop_price) : "🔒 Pro"}
              </p>
              <p className="font-mono text-[10px] text-muted">{convictionLabel}</p>
            </div>
          </div>

          {pick.status !== "open" && pick.close_reason ? (
            <p className="mt-3 rounded-sm border border-dashed border-border px-3 py-2 text-[12px] text-muted">
              <span className="label-caps mr-2">{d.closeReason}</span>
              {pick.close_reason}
            </p>
          ) : null}
        </header>

        <div className={`space-y-6 py-5 ${readerMode ? "reader-content-flow" : ""}`}>
          {canViewFull ? (
            <>
              <PickSection title={d.sections.thesis} md={pick.thesis_md} readerMode={readerMode} />
              <PickSection title={d.sections.catalysts} md={pick.catalysts_md} readerMode={readerMode} />
              <PickSection title={d.sections.risks} md={pick.risks_md} readerMode={readerMode} />
              <PickSection title={d.sections.valuation} md={pick.valuation_md} readerMode={readerMode} />
              <PickSection title={d.sections.discipline} md={pick.sell_discipline_md} readerMode={readerMode} />
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-muted">
                {plainTeaser(pick.thesis_md ?? pick.subtitle ?? "", 320)}
              </p>
              <ProductPaywallCard product="research" loggedIn={Boolean(user)} />
            </div>
          )}
        </div>

        {!canViewFull ? <StickyPaywall loggedIn={Boolean(user)} product="research" /> : null}

        <p className={`mt-8 pt-4 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
          {d.disclaimer}
        </p>
      </ReaderModeShell>
    </div>
    </ReaderPrefsProvider>
  );
}

function PickSection({
  title,
  md,
  readerMode,
}: {
  title: string;
  md: string | null;
  readerMode: boolean;
}) {
  if (!md || md.trim().length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <article
        className={`prose prose-sm md:prose-base max-w-none ${readerMode ? "" : "prose-invert"}`}
      >
        <div className={`whitespace-pre-wrap leading-relaxed ${readerMode ? "" : "text-[14px]"}`}>
          {md}
        </div>
      </article>
    </section>
  );
}
