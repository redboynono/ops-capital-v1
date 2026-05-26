import Link from "next/link";
import { Suspense } from "react";
import { AnalysisFilters } from "@/components/analysis-filters";
import { AnalysisPostsList } from "@/components/analysis-posts-list";
import { getCachedPostSectors } from "@/lib/cached-data";
import type { PostPeriod } from "@/lib/posts";

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
  searchParams: Promise<{ symbol?: string; sector?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const { symbol, sector, period } = sp;
  const periodFilter =
    period === "week" || period === "month" ? (period as PostPeriod) : undefined;

  const sectors = await getCachedPostSectors();

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">Research · 深度研报</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">机构级深度研报</h1>
          <p className="mt-1 text-[13px] text-muted">
            摘要免费阅读 · 全文、估值框架与 Ask AI 需 Research Pro
            {symbol ? ` · 标的：${symbol}` : ""}
            {sector ? ` · 行业：${sector}` : ""}
            {periodFilter ? ` · ${period === "week" ? "近一周" : "近一月"}` : ""}
          </p>
        </div>
        {symbol || sector || periodFilter ? (
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            清除筛选
          </Link>
        ) : null}
      </header>

      <AnalysisFilters sectors={sectors} current={{ symbol, sector, period }} />

      <section className="card px-4">
        <Suspense
          key={`${symbol ?? ""}-${sector ?? ""}-${period ?? ""}`}
          fallback={<PostsFallback />}
        >
          <AnalysisPostsList symbol={symbol} sector={sector} period={periodFilter} />
        </Suspense>
      </section>
    </div>
  );
}
