import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { PickEditor } from "@/components/pick-editor";

export const dynamic = "force-dynamic";

export default async function NewPickPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <Link href="/admin/picks" className="hover:text-accent-strong">OPS Picks</Link>
        <span className="mx-1">/</span>
        <span>新建</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">OPS Picks · 新建</span>
        <h1 className="mt-1 text-2xl font-bold">发布一条月度精选</h1>
        <p className="mt-1 text-[13px] text-muted">
          填写入场 / 目标 / 止损 / 投资逻辑。勾「已发布」后才对前台可见。
        </p>
      </header>

      <PickEditor mode="new" />
    </div>
  );
}
