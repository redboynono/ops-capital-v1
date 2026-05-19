import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPostsManager } from "@/components/admin-posts-manager";
import { requireAdmin } from "@/lib/admin";
import { listAllPostsAdmin } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; published?: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const sp = await searchParams;
  const published =
    sp.published === "published" ? "published" : sp.published === "draft" ? "draft" : "all";
  const posts = await listAllPostsAdmin({
    kind: sp.kind === "news" ? "news" : sp.kind === "analysis" ? "analysis" : undefined,
    published,
  });

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <span>内容管理</span>
      </nav>

      <header className="mt-3 mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">Posts</span>
          <h1 className="mt-1 text-2xl font-bold">文章库</h1>
          <p className="mt-1 text-[13px] text-muted">共 {posts.length} 篇 · 编辑 / 批量发布或下架</p>
        </div>
        <Link href="/admin/editor" className="btn-primary px-4 py-1.5 text-[13px]">
          + AI 新建
        </Link>
      </header>

      <div className="mb-4 flex gap-2 text-[12px]">
        <Link href="/admin/posts" className={published === "all" ? "text-accent-strong" : "text-muted"}>
          全部
        </Link>
        <Link href="/admin/posts?published=published" className={published === "published" ? "text-accent-strong" : "text-muted"}>
          已发布
        </Link>
        <Link href="/admin/posts?published=draft" className={published === "draft" ? "text-accent-strong" : "text-muted"}>
          草稿
        </Link>
        <span className="text-muted">|</span>
        <Link href="/admin/posts?kind=analysis" className="text-muted hover:text-accent-strong">分析</Link>
        <Link href="/admin/posts?kind=news" className="text-muted hover:text-accent-strong">快讯</Link>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center text-muted">暂无文章</div>
      ) : (
        <AdminPostsManager initial={posts} />
      )}
    </div>
  );
}
