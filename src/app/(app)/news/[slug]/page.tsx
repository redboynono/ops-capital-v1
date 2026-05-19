import Link from "next/link";
import { notFound } from "next/navigation";
import { AskAI } from "@/components/ask-ai";
import { ArticleToc } from "@/components/article-toc";
import { BookmarkButton } from "@/components/bookmark-button";
import { ShareButton } from "@/components/share/share-button";
import { getSessionUser } from "@/lib/auth";
import { isBookmarked, recordRead } from "@/lib/me";
import { extractTocFromMarkdown, shouldShowToc } from "@/lib/markdown-toc";
import { buildPostMetadata } from "@/lib/post-metadata";
import { RedactedMarkdown } from "@/lib/paywall";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "news") return { title: "快讯 · OPS Alpha" };
  return buildPostMetadata(post, "news");
}

export default async function NewsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reader?: string }>;
}) {
  const { slug } = await params;
  const { reader } = await searchParams;
  // 默认进入阅读模式；?reader=0 才显示终端视图
  const readerMode = reader !== "0";
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "news") notFound();

  const [tickers, user] = await Promise.all([
    listTickersForPost(post.id),
    getSessionUser(),
  ]);
  const bookmarked = user ? await isBookmarked(user.id, post.id) : false;
  if (user) recordRead(user.id, post.id).catch(() => null);

  const toggleHref = readerMode ? `/news/${post.slug}?reader=0` : `/news/${post.slug}`;
  const tocItems = extractTocFromMarkdown(post.content);
  const showToc = readerMode && shouldShowToc(post.content, 800);

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/news" className="hover:text-accent-strong">快讯</Link>
          <span className="mx-1">/</span>
          <span>{post.slug}</span>
        </div>
        <Link
          href={toggleHref}
          className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
        >
          {readerMode ? "☾ 终端视图" : "☀ 阅读模式"}
        </Link>
      </nav>

      <div className={readerMode ? "reader-mode mt-3" : "mt-3"}>
      <header className={readerMode ? "border-b border-[#d8d0c2] pb-3" : "border-b border-border pb-3"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-free">快讯</span>
          {tickers.map((t) => (
            <Link key={t.symbol} href={`/t/${t.symbol}`} className="chip">
              {t.symbol}
            </Link>
          ))}
          <span className="label-caps">
            {new Date(post.created_at).toLocaleString("zh-CN")}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-foreground">{post.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          {user ? <BookmarkButton postId={post.id} initialBookmarked={bookmarked} /> : null}
          {user ? <span className="mx-1 h-3 w-px bg-border" /> : null}
          <ShareButton
            variant="button"
            data={{
              type: "post",
              kind: "news",
              title: post.title,
              excerpt: post.excerpt,
              content: post.content,
              tickers: tickers.map((t) => t.symbol),
              createdAt: post.created_at,
            }}
            urlPath={`/news/${post.slug}`}
            fileNamePrefix={`ops_alpha_${post.slug}`}
          />
        </div>
      </header>

      <div className="flex gap-8">
        <article className="prose prose-sm min-w-0 max-w-none flex-1 py-4">
          <RedactedMarkdown redact={false} tocItems={showToc ? tocItems : undefined}>
            {post.content}
          </RedactedMarkdown>
        </article>
        {showToc ? <ArticleToc items={tocItems} readerMode /> : null}
      </div>

      <AskAI context={{ kind: "post", slug: post.slug }} loggedIn={Boolean(user)} />

      <p className={`mt-6 pt-3 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
        免责声明：本快讯由 AI 编辑流水线生成，仅供参考，不构成投资建议。
      </p>
      </div>
    </div>
  );
}
