import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPostEditor } from "@/components/admin-post-editor";
import { requireAdmin } from "@/lib/admin";
import { getPostByIdAdmin } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function AdminPostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) redirect("/admin");

  const { id } = await params;
  const post = await getPostByIdAdmin(id);
  if (!post) notFound();

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin">后台</Link>
        <span className="mx-1">/</span>
        <Link href="/admin/posts">文章库</Link>
        <span className="mx-1">/</span>
        <span>编辑</span>
      </nav>
      <header className="mt-3 mb-4 border-b border-border pb-3">
        <h1 className="text-xl font-bold">编辑文章</h1>
      </header>
      <AdminPostEditor post={post} />
    </div>
  );
}
