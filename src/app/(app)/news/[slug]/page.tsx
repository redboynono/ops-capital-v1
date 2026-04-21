import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookmarkButton } from "@/components/bookmark-button";
import { getSessionUser } from "@/lib/auth";
import { isBookmarked, recordRead } from "@/lib/me";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({
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
  if (!post || post.kind !== "news") notFound();

  const [tickers, user] = await Promise.all([
    listTickersForPost(post.id),
    getSessionUser(),
  ]);
  const bookmarked = user ? await isBookmarked(user.id, post.id) : false;
  if (user) recordRead(user.id, post.id).catch(() => null);

  const toggleHref = readerMode ? `/news/${post.slug}` : `/news/${post.slug}?reader=1`;

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
        {user ? (
          <div className="mt-2">
            <BookmarkButton postId={post.id} initialBookmarked={bookmarked} />
          </div>
        ) : null}
      </header>

      <article className="prose prose-sm max-w-none py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>

      <p className={`mt-6 pt-3 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
        免责声明：本快讯由 AI 编辑流水线生成，仅供参考，不构成投资建议。
      </p>
      </div>
    </div>
  );
}
