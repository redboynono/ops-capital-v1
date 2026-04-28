import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookmarkButton } from "@/components/bookmark-button";
import { ShareButton } from "@/components/share/share-button";
import { getSessionUser } from "@/lib/auth";
import { isBookmarked, recordRead } from "@/lib/me";
import { getCurrentUserSubscriptionStatus, getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export default async function AnalysisDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reader?: string }>;
}) {
  const { slug } = await params;
  const { reader } = await searchParams;
  const readerMode = reader === "1";
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "analysis") notFound();

  const [{ subscribed }, tickers, user] = await Promise.all([
    getCurrentUserSubscriptionStatus(),
    listTickersForPost(post.id),
    getSessionUser(),
  ]);

  const canViewFull = !post.is_premium || subscribed;
  const bookmarked = user ? await isBookmarked(user.id, post.id) : false;
  if (user) recordRead(user.id, post.id).catch(() => null);

  const toggleHref = readerMode ? `/analysis/${post.slug}` : `/analysis/${post.slug}?reader=1`;

  return (
    <div className="mx-auto w-full max-w-[840px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/analysis" className="hover:text-accent-strong">分析</Link>
          <span className="mx-1">/</span>
          <span>{post.slug}</span>
        </div>
        <Link
          href={toggleHref}
          className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
          title="切换阅读模式"
        >
          {readerMode ? "☾ 终端视图" : "☀ 阅读模式"}
        </Link>
      </nav>

      <div className={readerMode ? "reader-mode mt-3" : "mt-3"}>
      <header className={readerMode ? "border-b border-[#d8d0c2] pb-4" : "border-b border-border pb-4"}>
        <div className="flex flex-wrap items-center gap-2">
          {post.is_premium ? <span className="badge-premium">PRO</span> : <span className="badge-free">公开</span>}
          {tickers.map((t) => (
            <Link key={t.symbol} href={`/t/${t.symbol}`} className="chip">
              {t.symbol}
            </Link>
          ))}
          <span className="label-caps">
            {new Date(post.created_at).toLocaleDateString("zh-CN")}
          </span>
        </div>
        <h1 className="mt-2 font-[var(--font-brand-serif)] text-3xl font-bold leading-snug text-foreground md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-soft">{post.excerpt}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="label-caps">作者</span>
          <span className="text-[12px] font-semibold">Ops Alpha AI · 编辑精选</span>
          <span className="mx-2 h-3 w-px bg-border" />
          {user ? <BookmarkButton postId={post.id} initialBookmarked={bookmarked} /> : null}
          <span className="mx-2 h-3 w-px bg-border" />
          <ShareButton
            variant="button"
            data={{
              type: "post",
              kind: "analysis",
              title: post.title,
              excerpt: post.excerpt,
              content: canViewFull ? post.content : null,
              tickers: tickers.map((t) => t.symbol),
              createdAt: post.created_at,
            }}
            urlPath={`/analysis/${post.slug}`}
            fileNamePrefix={`ops_alpha_${post.slug}`}
          />
        </div>
      </header>

      {canViewFull ? (
        <article className="prose prose-sm md:prose-base max-w-none py-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </article>
      ) : (
        <>
          <article className="prose prose-sm md:prose-base max-w-none py-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {post.content.slice(0, 400) + "\n\n..."}
            </ReactMarkdown>
          </article>
          <div className="card mt-4 border-accent/60 p-6" style={{ background: "var(--paywall)" }}>
            <p className="label-caps">Premium 内容</p>
            <h3 className="mt-1 text-lg font-bold">订阅后继续阅读完整分析</h3>
            <p className="mt-1 text-[13px] text-muted">
              订阅即解锁全部 Premium 分析 + 估值模型 + 每周备忘录。
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/pricing" className="btn-primary px-3 py-1.5 text-[12px]">
                查看订阅方案
              </Link>
              {!user ? (
                <Link href="/login" className="btn-outline px-3 py-1.5 text-[12px]">
                  登录
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}

      <p className={`mt-8 pt-4 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
        免责声明：本文由 AI 编辑流水线生成并经人工复核，仅为研究观点，不构成投资建议。
      </p>
      </div>
    </div>
  );
}
