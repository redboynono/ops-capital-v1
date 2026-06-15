import Link from "next/link";
import { Suspense } from "react";
import { NewsPostsList } from "@/components/news-posts-list";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { resolveLayerFilter } from "@/lib/marketing/layer-filter";

export const revalidate = 180;

function PostsFallback() {
  return (
    <div className="animate-pulse px-4 py-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="border-b border-border py-4">
          <div className="h-3 w-24 rounded bg-surface-muted" />
          <div className="mt-2 h-5 w-[80%] max-w-sm rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; layer?: string }>;
}) {
  const { symbol, layer: layerParam } = await searchParams;
  const { layer, symbols } = resolveLayerFilter(layerParam);
  const locale = await getLocale();
  const n = getDictionary(locale).news;
  const layerName = layer ? (locale === "en" ? layer.nameEn : layer.nameZh) : null;

  let subtitle = n.subtitle;
  if (layer && layerName) {
    subtitle += fmt(n.subtitleLayerFmt, { id: layer.id, name: layerName });
  } else if (symbol) {
    subtitle += fmt(n.subtitleSymbolFmt, { symbol });
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">{n.label}</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{n.title}</h1>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        {symbol || layer ? (
          <Link href="/news" className="btn-outline px-3 py-1.5 text-[12px]">
            {n.clearFilters}
          </Link>
        ) : null}
      </header>

      {layer && layerName ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="label-caps text-muted">{n.valueChain}</span>
          <span className="rounded border border-accent bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong">
            {layer.id} · {layerName}
          </span>
          <Link href="/#value-chain" className="text-muted hover:text-accent">
            {n.backToVc}
          </Link>
        </div>
      ) : null}

      <section className="card px-4">
        <Suspense key={`${symbol ?? ""}-${layer?.id ?? "all"}`} fallback={<PostsFallback />}>
          <NewsPostsList symbol={layer ? undefined : symbol} symbols={symbols} />
        </Suspense>
      </section>
    </div>
  );
}
