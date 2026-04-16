import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { getCurrentUserSubscriptionStatus, getPostBySlug } from "@/lib/posts";
import { SubscribeButton } from "@/components/subscribe-button";

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <article className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <div className="mb-8 border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-zinc-500">{new Date(post.created_at).toLocaleString()}</p>
        </div>

        {canReadFull ? (
          <div className="prose prose-invert prose-zinc max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="relative">
            <div className="prose prose-invert prose-zinc max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.excerpt}</ReactMarkdown>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-transparent" />

            <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-lg font-semibold">解锁机构级宏观研报</p>
              <p className="mt-2 text-sm text-zinc-300">
                当前内容为摘要预览。订阅后可访问完整策略框架、估值模型与风险路径。
              </p>
              <div className="mt-4">
                <SubscribeButton plan="monthly" />
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
