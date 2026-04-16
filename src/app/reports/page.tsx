import Link from "next/link";
import { getPublishedPosts } from "@/lib/posts";

export default async function ReportsPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold">研报中心</h1>
        <p className="mt-2 text-zinc-400">机构级宏观与科技深度研究。</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/reports/${post.slug}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500">{new Date(post.created_at).toLocaleDateString()}</p>
                {post.is_premium ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">PRO</span>
                ) : null}
              </div>
              <h2 className="text-lg font-medium group-hover:text-emerald-300">{post.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-400">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
