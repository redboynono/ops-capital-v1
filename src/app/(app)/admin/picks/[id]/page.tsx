import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PickEditor } from "@/components/pick-editor";
import { getPickById } from "@/lib/picks";

export const dynamic = "force-dynamic";

export default async function EditPickPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const pick = await getPickById(id);
  if (!pick) notFound();

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <Link href="/admin/picks" className="hover:text-accent-strong">OPS Picks</Link>
        <span className="mx-1">/</span>
        <span className="font-mono">{pick.ticker_symbol}</span>
      </nav>

      <header className="mt-3 mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">编辑 · {pick.ticker_symbol}</span>
          <h1 className="mt-1 text-2xl font-bold">{pick.title}</h1>
          <p className="mt-1 text-[13px] text-muted">
            状态：<span className="font-mono">{pick.status}</span> ·
            发布：<span className="font-mono">{pick.is_published ? "已发布" : "草稿"}</span> ·
            入场：<span className="font-mono">{new Date(pick.entry_date).toISOString().slice(0, 10)}</span>
          </p>
        </div>
        {pick.is_published ? (
          <Link
            href={`/picks/${pick.slug}`}
            target="_blank"
            className="btn-outline px-3 py-1.5 text-[12px]"
          >
            查看前台 →
          </Link>
        ) : null}
      </header>

      <PickEditor mode="edit" initial={pick} />
    </div>
  );
}
