import Link from "next/link";
import { getPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in flex flex-col gap-4 border-b border-border/70 pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">研报中心</p>
            <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground md:text-6xl">
              机构级宏观与科技研究网。
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
              编辑精选的机构级研报，将政策、流动性、盈利与科技结构信号结成一个连贯的决策视图。
            </p>
          </div>
          <div className="glass-panel inline-flex items-center gap-4 self-start rounded-full px-5 py-2.5 text-xs uppercase tracking-[0.28em] text-accent-soft/85 md:self-auto">
            <span>{posts.length} 篇已发布</span>
            <span className="h-3 w-px bg-border/80" />
            <span>持续更新</span>
          </div>
        </section>

        <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <Link
              key={post.id}
              href={`/reports/${post.slug}`}
              className="glass-panel rise-in group relative flex flex-col rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/60"
              style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  {new Date(post.created_at).toLocaleDateString()}
                </p>
                {post.is_premium ? (
                  <span className="rounded-full border border-accent/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-soft">
                    付费
                  </span>
                ) : (
                  <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    公开
                  </span>
                )}
              </div>

              <h2 className="font-[var(--font-brand-serif)] text-2xl leading-snug text-foreground group-hover:text-accent-soft">
                {post.title}
              </h2>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>

              <span className="mt-auto pt-6 text-xs uppercase tracking-[0.24em] text-accent-soft/85 group-hover:text-accent-soft">
                阅读研报 →
              </span>
            </Link>
          ))}
        </section>

        {posts.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-border/70 bg-surface/60 p-8 text-center text-sm text-muted">
            暂无已发布研报，稍后再来查看。
          </p>
        ) : null}
      </div>
    </div>
  );
}
