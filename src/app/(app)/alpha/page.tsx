import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketSnapshot } from "@/components/market-snapshot";
import { PostRow } from "@/components/post-row";
import { TopRatedPanel } from "@/components/top-rated";
import { listPosts } from "@/lib/posts";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/alpha");

  const [analysis, news] = await Promise.all([
    listPosts({ kind: "analysis", limit: 10 }),
    listPosts({ kind: "news", limit: 10 }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <MarketSnapshot />

      <div className="mt-5">
        <TopRatedPanel limit={6} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Trending Analysis */}
        <section className="card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">热门分析</h2>
              <p className="text-[11px] text-muted">AI 编辑团队精选 · 机构级长文</p>
            </div>
            <Link href="/analysis" className="text-[12px] font-semibold text-accent-strong hover:underline">
              查看全部 →
            </Link>
          </header>
          <div className="px-4">
            {analysis.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">
                暂无分析文章。先到
                <Link href="/admin/editor" className="mx-1 text-accent-strong hover:underline">
                  编辑器
                </Link>
                生成一篇。
              </p>
            ) : (
              analysis.map((p) => <PostRow key={p.id} post={p} />)
            )}
          </div>
        </section>

        {/* Trending News */}
        <section className="card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">今日快讯</h2>
              <p className="text-[11px] text-muted">精选市场事件 · 全文免费</p>
            </div>
            <Link href="/news" className="text-[12px] font-semibold text-accent-strong hover:underline">
              全部快讯 →
            </Link>
          </header>
          <div className="px-4 py-1">
            {news.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">暂无快讯。</p>
            ) : (
              <ol className="sa-list">
                {news.map((n) => (
                  <li key={n.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      {n.tickers?.slice(0, 3).map((s) => (
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
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">解锁完整 Premium 研报</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              $9.99/月 · $87.99/年 · 完整分析 + 估值模型 + 每周备忘录
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/pricing" className="btn-primary px-3 py-1.5 text-[12px]">
              查看方案
            </Link>
            <Link href="/login?tab=signup" className="btn-outline px-3 py-1.5 text-[12px]">
              免费注册
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-soft">
        免责声明：Ops Alpha 内容由 AI 编辑流水线辅助生成，仅供投资学习与研究参考，不构成任何买卖建议。
        投资有风险，决策需谨慎。
      </p>
    </div>
  );
}
