import Link from "next/link";
import { Suspense } from "react";
import { AnalysisFilters } from "@/components/analysis-filters";
import { AnalysisPostsList } from "@/components/analysis-posts-list";
import { getCachedPostSectors } from "@/lib/cached-data";
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

  const sectors = await getCachedPostSectors();

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">Research · 深度研报</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">机构级深度研报</h1>
          <p className="mt-1 text-[13px] text-muted">
            摘要免费阅读 · 全文、估值框架与 Ask AI 需 Research Pro
            {layer ? ` · 价值链 ${layer.id} · ${layer.nameZh}` : ""}
            {!layer && symbol ? ` · 标的：${symbol}` : ""}
            {sector ? ` · 行业：${sector}` : ""}
            {periodFilter ? ` · ${period === "week" ? "近一周" : "近一月"}` : ""}
          </p>
        </div>
        {symbol || sector || periodFilter || layer ? (
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            清除筛选
          </Link>
        ) : null}
      </header>

      {layer ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="label-caps text-muted">价值链</span>
          <span className="rounded border border-accent bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong">
            {layer.id} · {layer.nameZh}
          </span>
          <Link href="/#value-chain" className="text-muted hover:text-accent">
            返回官网六层模型 →
          </Link>
        </div>
      ) : null}

      <AnalysisFilters sectors={sectors} current={{ symbol, sector, period }} />

      <section className="card px-4">
        <Suspense
          key={`${symbol ?? ""}-${sector ?? ""}-${period ?? ""}-${layer?.id ?? ""}`}
          fallback={<PostsFallback />}
        >
          <AnalysisPostsList
            symbol={layer ? undefined : symbol}
            symbols={symbols}
            sector={sector}
            period={periodFilter}
          />
        </Suspense>
      </section>
    </div>
  );
}
