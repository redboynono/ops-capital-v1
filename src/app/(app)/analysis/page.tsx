import Link from "next/link";
import { PostRow } from "@/components/post-row";
import { listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function AnalysisListPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const posts = await listPosts({ kind: "analysis", symbol });

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">分析 Analysis</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">机构级长文研究</h1>
          <p className="mt-1 text-[13px] text-muted">
            摘要免费 · 完整观点与估值模型需要 Premium 订阅
            {symbol ? ` · 按标的筛选：${symbol}` : ""}
          </p>
        </div>
        {symbol ? (
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            清除筛选
          </Link>
        ) : null}
      </header>

      <section className="card px-4">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted">暂无文章。</p>
        ) : (
          posts.map((p) => <PostRow key={p.id} post={p} />)
        )}
      </section>
    </div>
  );
}
