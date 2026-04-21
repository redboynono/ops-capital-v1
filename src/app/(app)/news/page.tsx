import Link from "next/link";
import { listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function NewsListPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const items = await listPosts({ kind: "news", symbol });

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
        {items.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-muted">暂无快讯。</p>
        ) : (
          <ol className="sa-list">
            {items.map((n) => (
              <li key={n.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {n.tickers?.slice(0, 4).map((s) => (
                    <Link key={s} href={`/t/${s}`} className="chip">
                      {s}
                    </Link>
                  ))}
                  <span className="label-caps">
                    {new Date(n.created_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <Link href={`/news/${n.slug}`} className="link-title mt-1 block text-[14px] leading-snug">
                  {n.title}
                </Link>
                {n.excerpt ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
