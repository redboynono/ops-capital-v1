import Link from "next/link";
import { Suspense } from "react";
import { NewsPostsList } from "@/components/news-posts-list";

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
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">快讯 News</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">市场快讯时间流</h1>
          <p className="mt-1 text-[13px] text-muted">
            短篇事件 · 全文免费{symbol ? ` · 按标的筛选：${symbol}` : ""}
          </p>
        </div>
        {symbol ? (
          <Link href="/news" className="btn-outline px-3 py-1.5 text-[12px]">
            清除筛选
          </Link>
        ) : null}
      </header>

      <section className="card px-4">
        <Suspense key={symbol ?? "all"} fallback={<PostsFallback />}>
          <NewsPostsList symbol={symbol} />
        </Suspense>
      </section>
    </div>
  );
}
