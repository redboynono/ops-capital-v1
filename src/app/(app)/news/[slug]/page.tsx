import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post || post.kind !== "news") notFound();

  const tickers = await listTickersForPost(post.id);

  return (
    <div className="mx-auto w-full max-w-[780px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/news" className="hover:text-accent-strong">快讯</Link>
        <span className="mx-1">/</span>
        <span>{post.slug}</span>
      </nav>

      <header className="mt-3 border-b border-border pb-3">
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
      </header>

      <article className="prose prose-sm max-w-none py-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        免责声明：本快讯由 AI 编辑流水线生成，仅供参考，不构成投资建议。
      </p>
    </div>
  );
}
