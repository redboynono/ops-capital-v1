import Link from "next/link";
import { notFound } from "next/navigation";
import { AskAI } from "@/components/ask-ai";
import { BookmarkButton } from "@/components/bookmark-button";
import { ShareButton } from "@/components/share/share-button";
import { StickyPaywall } from "@/components/sticky-paywall";
import { getSessionUser } from "@/lib/auth";
import { isBookmarked, recordRead } from "@/lib/me";
import { splitForPaywall } from "@/lib/content-preview";
import { hasResearchAccess } from "@/lib/entitlements";
import { RedactedMarkdown } from "@/lib/paywall";
import { FtPaywallGate } from "@/components/ft-paywall-gate";
import { extractTocFromMarkdown, shouldShowToc } from "@/lib/markdown-toc";
import { buildPostMetadata } from "@/lib/post-metadata";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";
import { ArticleToc } from "@/components/article-toc";
import { ReaderModeShell, ReaderPrefsProvider, ReaderPrefsToolbar } from "@/components/reader-prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "analysis") return { title: "分析 · OPS Alpha" };
  return buildPostMetadata(post, "analysis");
}

export default async function AnalysisDetailPage({
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
  if (!post || post.kind !== "analysis") notFound();

  const [user, tickers] = await Promise.all([
    getSessionUser(),
    listTickersForPost(post.id),
  ]);

  const canViewFull = !post.is_premium || hasResearchAccess(user);
  const bookmarked = user ? await isBookmarked(user.id, post.id) : false;
  if (user) recordRead(user.id, post.id).catch(() => null);

  const toggleHref = readerMode ? `/analysis/${post.slug}?reader=0` : `/analysis/${post.slug}`;
  const tocItems = extractTocFromMarkdown(post.content);
  // 仅订阅用户渲染正文，故目录侧栏也仅对其展示（否则锚点无对应内容）
  const showToc = readerMode && canViewFull && shouldShowToc(post.content);

  return (
    <ReaderPrefsProvider enabled={readerMode}>
    <div className="mx-auto w-full max-w-[840px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/analysis" className="hover:text-accent-strong">分析</Link>
          <span className="mx-1">/</span>
          <span>{post.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <ReaderPrefsToolbar />
          <Link
            href={toggleHref}
            className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
            title="切换阅读模式"
          >
            {readerMode ? "☾ 终端视图" : "☀ 阅读模式"}
          </Link>
        </div>
      </nav>

      <ReaderModeShell>
      <header className={readerMode ? "border-b border-[#d8d0c2] pb-4" : "border-b border-border pb-4"}>
        <div className="flex flex-wrap items-center gap-2">
          {post.is_premium ? (
            <span className="badge-premium">Research</span>
          ) : (
            <span className="badge-free">公开</span>
          )}
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
        {canViewFull ? (
          <p className="article-lede mt-2 text-[14px] leading-relaxed">{post.excerpt}</p>
        ) : null}
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

      <div className={`flex gap-8 ${readerMode ? "reader-content-flow" : ""} ${showToc ? "xl:pr-0" : ""}`}>
        <article className={`prose prose-sm md:prose-base min-w-0 max-w-none flex-1 py-5 ${readerMode ? "" : "prose-invert"}`}>
          {canViewFull ? (
            <RedactedMarkdown redact={false} tocItems={showToc ? tocItems : undefined}>
              {post.content}
            </RedactedMarkdown>
          ) : (
            <FtPaywallGate
              split={splitForPaywall(post.content)}
              loggedIn={Boolean(user)}
              loginRedirect={`/analysis/${post.slug}`}
            />
          )}
        </article>
        {showToc ? <ArticleToc items={tocItems} readerMode /> : null}
      </div>

      {!canViewFull ? <StickyPaywall loggedIn={Boolean(user)} product="research" /> : null}

      {canViewFull ? (
        <AskAI context={{ kind: "post", slug: post.slug }} loggedIn={Boolean(user)} />
      ) : null}

      <p className={`mt-8 pt-4 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
        免责声明：本文由 AI 编辑流水线生成并经人工复核，仅为研究观点，不构成投资建议。
      </p>
      </ReaderModeShell>
    </div>
    </ReaderPrefsProvider>
  );
}
