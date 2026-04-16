import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalButton } from "@/components/portal-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold">个人中心</h1>
        <p className="mt-2 text-zinc-400">欢迎回来，{user?.email}</p>
        <div className="mt-4">
          <PortalButton />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/profile" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700">
            <h2 className="text-lg font-medium">Profile</h2>
            <p className="mt-2 text-sm text-zinc-400">更新姓名、查看账户信息</p>
          </Link>

          <Link href="/pricing" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700">
            <h2 className="text-lg font-medium">Subscription</h2>
            <p className="mt-2 text-sm text-zinc-400">管理订阅与升级方案</p>
          </Link>

          <Link href="/admin/editor" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700">
            <h2 className="text-lg font-medium">AI Editor</h2>
            <p className="mt-2 text-sm text-zinc-400">生成并编辑机构级投研草稿</p>
          </Link>

          <Link href="/reports" className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700">
            <h2 className="text-lg font-medium">Reports</h2>
            <p className="mt-2 text-sm text-zinc-400">查看公开和付费研报</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
