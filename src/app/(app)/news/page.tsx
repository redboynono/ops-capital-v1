import Link from "next/link";
import { Suspense } from "react";
import { NewsPostsList } from "@/components/news-posts-list";
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

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">快讯 News</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">市场快讯时间流</h1>
          <p className="mt-1 text-[13px] text-muted">
            短篇事件 · 全文免费
            {layer ? ` · 价值链 ${layer.id} · ${layer.nameZh}` : ""}
            {!layer && symbol ? ` · 按标的筛选：${symbol}` : ""}
          </p>
        </div>
        {symbol || layer ? (
          <Link href="/news" className="btn-outline px-3 py-1.5 text-[12px]">
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

      <section className="card px-4">
        <Suspense key={`${symbol ?? ""}-${layer?.id ?? "all"}`} fallback={<PostsFallback />}>
          <NewsPostsList symbol={layer ? undefined : symbol} symbols={symbols} />
        </Suspense>
      </section>
    </div>
  );
}
