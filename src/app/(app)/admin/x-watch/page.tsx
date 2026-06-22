import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminXWatchPanel } from "@/components/admin-x-watch-panel";
import { requireAdmin } from "@/lib/admin";
import { getXWatchMeta, listXWatchItems } from "@/lib/x-watch";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "X 监听 · Admin",
};

export default async function AdminXWatchPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login?redirect=/admin/x-watch");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const [meta, items] = await Promise.all([getXWatchMeta(), listXWatchItems(40, "pending")]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">
          后台
        </Link>
        <span className="mx-1">/</span>
        <span>X 监听</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">X Watch · Serenity</span>
        <h1 className="mt-1 text-2xl font-bold">X 新帖解读 & 回复</h1>
        <p className="mt-1 text-[13px] text-muted">
          深度理解 @{meta.username} 每条新 topic · 生成简约英文回复草稿 · admin 审阅后发送
        </p>
      </header>

      <AdminXWatchPanel initialItems={items} initialMeta={meta} />
    </div>
  );
}
