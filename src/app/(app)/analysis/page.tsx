import Link from "next/link";
import { Suspense } from "react";
import { AnalysisFilters } from "@/components/analysis-filters";
import { AnalysisPostsList } from "@/components/analysis-posts-list";
import { getCachedPostSectors } from "@/lib/cached-data";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { layerLocalized } from "@/lib/marketing/ai-value-chain";
import type { PostPeriod } from "@/lib/posts";
import { resolveLayerFilter } from "@/lib/marketing/layer-filter";

export const revalidate = 180;

function PostsFallback() {
  return (
    <div className="animate-pulse px-4 py-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border-b border-border py-4">
          <div className="h-3 w-20 rounded bg-surface-muted" />
          <div className="mt-2 h-5 w-3/4 max-w-md rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export default async function AnalysisListPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; sector?: string; period?: string; layer?: string }>;
}) {
  const sp = await searchParams;
  const { symbol, sector, period, layer: layerParam } = sp;
  const periodFilter =
    period === "week" || period === "month" ? (period as PostPeriod) : undefined;
  const { layer, symbols } = resolveLayerFilter(layerParam);
  const [locale, sectors] = await Promise.all([getLocale(), getCachedPostSectors()]);
  const t = getDictionary(locale).analysis;
  const c = getDictionary(locale).common;

  let subtitle = t.subtitle;
  if (layer) {
    const ln = layerLocalized(layer, locale);
    subtitle += fmt(t.subtitleLayerFmt, { id: layer.id, name: ln.name });
  }
  if (!layer && symbol) subtitle += fmt(t.subtitleSymbolFmt, { symbol });
  if (sector) subtitle += fmt(t.subtitleSectorFmt, { sector });
  if (periodFilter) subtitle += period === "week" ? t.subtitlePeriodWeek : t.subtitlePeriodMonth;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">{t.label}</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        {symbol || sector || periodFilter || layer ? (
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            {t.clearFilters}
          </Link>
        ) : null}
      </header>

      {layer ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="label-caps text-muted">{c.valueChain}</span>
          <span className="rounded border border-accent bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong">
            {layer.id} · {layerLocalized(layer, locale).name}
          </span>
          <Link href="/#value-chain" className="text-muted hover:text-accent">
            {t.backToVc}
          </Link>
        </div>
      ) : null}

      <AnalysisFilters sectors={sectors} current={{ symbol, sector, period }} locale={locale} />

      <section className="card px-4">
        <Suspense
          key={`${symbol ?? ""}-${sector ?? ""}-${period ?? ""}-${layer?.id ?? ""}-${locale}`}
          fallback={<PostsFallback />}
        >
          <AnalysisPostsList
            symbol={layer ? undefined : symbol}
            symbols={symbols}
            sector={sector}
            period={periodFilter}
            locale={locale}
          />
        </Suspense>
      </section>
    </div>
  );
}
