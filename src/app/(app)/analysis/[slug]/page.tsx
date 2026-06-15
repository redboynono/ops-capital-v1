import Link from "next/link";
import { notFound } from "next/navigation";
import { AskAI } from "@/components/ask-ai";
import { BookmarkButton } from "@/components/bookmark-button";
import { ShareButton } from "@/components/share/share-button";
import { StickyPaywall } from "@/components/sticky-paywall";
import { getSessionUser } from "@/lib/auth";
import { getPostReaderCount, isBookmarked, recordRead } from "@/lib/me";
import { bodyTeaser } from "@/lib/content-preview";
import { hasResearchAccess } from "@/lib/entitlements";
import { RedactedMarkdown } from "@/lib/paywall";
import { ArticleSummaryGate } from "@/components/article-summary-gate";
import { extractTocFromMarkdown, shouldShowToc } from "@/lib/markdown-toc";
import { buildPostMetadata } from "@/lib/post-metadata";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";
import { ArticleToc } from "@/components/article-toc";
import { SentimentStrip } from "@/components/sentiment-strip";
import { ReaderModeShell, ReaderPrefsProvider, ReaderPrefsToolbar } from "@/components/reader-prefs";
import { formatDate } from "@/lib/i18n/common";
import { getDictionary, getLocale } from "@/lib/i18n";
import { hasEnglishBody, postContent, postExcerpt, postTitle } from "@/lib/i18n/post-locale";
import { isUsEquityTicker } from "@/lib/polygon";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "analysis") {
    const locale = await getLocale();
    return { title: getDictionary(locale).meta.analysisTitle };
  }
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
  const readerMode = reader !== "0";
  const [locale, post] = await Promise.all([getLocale(), getPostBySlug(slug)]);
  const dict = getDictionary(locale);
  const t = dict.analysis;
  const c = dict.common;

  if (!post || post.kind !== "analysis") notFound();

  const [user, tickers] = await Promise.all([
    getSessionUser(),
    listTickersForPost(post.id),
  ]);

  const canViewFull = !post.is_premium || hasResearchAccess(user);
  const bookmarked = user ? await isBookmarked(user.id, post.id) : false;
  const readers = canViewFull ? 0 : await getPostReaderCount(post.id);
  if (user) recordRead(user.id, post.id).catch(() => null);

  const toggleHref = readerMode ? `/analysis/${post.slug}?reader=0` : `/analysis/${post.slug}`;
  const title = postTitle(post, locale);
  const excerpt = postExcerpt(post, locale);
  let body = postContent(post, locale);
  if (/^#\s+/m.test(body)) body = body.replace(/^#\s+[^\n]+\n+/, "");
  const tocItems = extractTocFromMarkdown(body);
  const showToc = readerMode && canViewFull && shouldShowToc(body);
  const showZhBodyNotice = locale === "en" && canViewFull && !hasEnglishBody(post);
  const primarySymbol = tickers[0]?.symbol;
  const showSentiment = primarySymbol && isUsEquityTicker(primarySymbol);

  return (
    <ReaderPrefsProvider enabled={readerMode}>
    <div className="mx-auto w-full max-w-[840px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/analysis" className="hover:text-accent-strong">{t.breadcrumb}</Link>
          <span className="mx-1">/</span>
          <span>{post.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <ReaderPrefsToolbar />
          <Link
            href={toggleHref}
            className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
            title={t.readerToggle}
          >
            {readerMode ? t.readerTerminal : t.readerReading}
          </Link>
        </div>
      </nav>

      <ReaderModeShell>
      <header className={readerMode ? "border-b border-[#d8d0c2] pb-4" : "border-b border-border pb-4"}>
        <div className="flex flex-wrap items-center gap-2">
          {post.is_premium ? (
            <span className="badge-premium">Research</span>
          ) : (
            <span className="badge-free">{c.public}</span>
          )}
          {tickers.map((tk) => (
            <Link key={tk.symbol} href={`/t/${tk.symbol}`} className="chip">
              {tk.symbol}
            </Link>
          ))}
          <span className="label-caps">{formatDate(locale, post.created_at)}</span>
        </div>
        <h1 className="mt-2 font-[var(--font-brand-serif)] text-3xl font-bold leading-snug text-foreground md:text-4xl">
          {title}
        </h1>
        {canViewFull && excerpt ? (
          <p className="article-lede mt-2 text-[14px] leading-relaxed">{excerpt}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <span className="label-caps">{c.author}</span>
          <span className="text-[12px] font-semibold">{c.authorLine}</span>
          <span className="mx-2 h-3 w-px bg-border" />
          {user ? <BookmarkButton postId={post.id} initialBookmarked={bookmarked} /> : null}
          <span className="mx-2 h-3 w-px bg-border" />
          <ShareButton
            variant="button"
            data={{
              type: "post",
              kind: "analysis",
              title,
              excerpt,
              content: canViewFull ? body : null,
              tickers: tickers.map((tk) => tk.symbol),
              createdAt: post.created_at,
            }}
            urlPath={`/analysis/${post.slug}`}
            fileNamePrefix={`ops_alpha_${post.slug}`}
          />
        </div>
      </header>

      {showSentiment ? <SentimentStrip symbol={primarySymbol} /> : null}

      <div className={`flex gap-8 ${readerMode ? "reader-content-flow" : ""} ${showToc ? "xl:pr-0" : ""}`}>
        <article className={`prose prose-sm md:prose-base min-w-0 max-w-none flex-1 py-5 ${readerMode ? "" : "prose-invert"}`}>
          {showZhBodyNotice ? (
            <p className="not-prose mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              {t.bodyZhOnly}
            </p>
          ) : null}
          {canViewFull ? (
            <RedactedMarkdown redact={false} tocItems={showToc ? tocItems : undefined}>
              {body}
            </RedactedMarkdown>
          ) : (
            <ArticleSummaryGate
              excerpt={excerpt}
              teaser={bodyTeaser(body, 460)}
              sections={tocItems}
              readers={readers}
              locale={locale}
            />
          )}
        </article>
        {showToc ? <ArticleToc items={tocItems} readerMode /> : null}
      </div>

      {!canViewFull ? <StickyPaywall loggedIn={Boolean(user)} product="research" locale={locale} /> : null}

      {canViewFull ? (
        <AskAI context={{ kind: "post", slug: post.slug }} loggedIn={Boolean(user)} />
      ) : null}

      <p className={`mt-8 pt-4 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
        {t.detailDisclaimer}
      </p>
      </ReaderModeShell>
    </div>
    </ReaderPrefsProvider>
  );
}
