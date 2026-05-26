import { PostRow } from "@/components/post-row";
import { getCachedPosts } from "@/lib/cached-data";
import type { PostPeriod } from "@/lib/posts";

const PAGE_SIZE = 40;

export async function AnalysisPostsList({
  symbol,
  sector,
  period,
}: {
  symbol?: string;
  sector?: string;
  period?: PostPeriod;
}) {
  const posts = await getCachedPosts({
    kind: "analysis",
    limit: PAGE_SIZE,
    symbol,
    sector,
    period,
  });

  if (posts.length === 0) {
    return <p className="py-16 text-center text-[13px] text-muted">暂无文章。</p>;
  }

  return (
    <>
      {posts.map((p) => (
        <PostRow key={p.id} post={p} />
      ))}
      {posts.length >= PAGE_SIZE ? (
        <p className="border-t border-border py-3 text-center text-[12px] text-muted">
          已显示最近 {PAGE_SIZE} 篇 · 使用上方筛选缩小范围
        </p>
      ) : null}
    </>
  );
}
