import Link from "next/link";
import { redirect } from "next/navigation";

import { ConvictionAdmin } from "@/components/conviction-admin";
import { requireAdmin } from "@/lib/admin";
import { listAllConvictionLists, listPicksForList, type ConvictionList, type ConvictionPick } from "@/lib/conviction";

export const dynamic = "force-dynamic";

export default async function AdminConvictionPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const lists = await listAllConvictionLists();
  const listsWithPicks: { list: ConvictionList; picks: ConvictionPick[] }[] = await Promise.all(
    lists.map(async (l) => ({ list: l, picks: await listPicksForList(l.id) })),
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">Admin</Link>
        <span className="mx-1">/</span>
        <span>Conviction Picks</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">Admin · Conviction</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">月度高信念榜单</h1>
        <p className="mt-1 text-[13px] text-muted">
          创建 / 关闭榜单，添加 / 删除 picks，公开页：
          <Link href="/conviction" className="ml-1 text-accent-strong hover:underline">
            /conviction
          </Link>
        </p>
      </header>

      <ConvictionAdmin initialLists={listsWithPicks} />
    </div>
  );
}
