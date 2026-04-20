import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { getCurrentUserSubscriptionStatus, getPostBySlug } from "@/lib/posts";
import { SubscribeButton } from "@/components/subscribe-button";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const { subscribed } = await getCurrentUserSubscriptionStatus();
  const canReadFull = !post.is_premium || subscribed;

  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(176,139,87,0.12),transparent_40%)]" />

      <article className="relative mx-auto w-full max-w-3xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <header className="rise-in border-b border-border/70 pb-8">
          <p className="text-xs uppercase tracking-[0.32em] text-accent-soft/85">
            {post.is_premium ? "付费研报" : "公开研报"}
          </p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-4xl leading-[1.08] text-foreground md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-muted">
            {new Date(post.created_at).toLocaleString()}
          </p>
        </header>

        {canReadFull ? (
          <div className="prose prose-invert prose-zinc mt-10 max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="relative mt-10">
            <div className="prose prose-invert prose-zinc max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.excerpt}</ReactMarkdown>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/90 to-transparent" />

            <div className="mt-10 rounded-3xl border border-accent/55 bg-[linear-gradient(140deg,rgba(176,139,87,0.14),rgba(15,19,27,0.85))] p-6 shadow-[0_40px_80px_-40px_rgba(176,139,87,0.35)] md:p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-accent-soft">解锁机构级研报</p>
              <h2 className="mt-4 font-[var(--font-brand-serif)] text-3xl text-foreground">
                完整框架、估值模型与风险路径。
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                当前内容仅为摘要预览。订阅后可解锁完整策略框架、估值模型与情景分析。
              </p>
              <div className="mt-6">
                <SubscribeButton plan="monthly" />
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
