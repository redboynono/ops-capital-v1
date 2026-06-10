import Link from "next/link";
import { redirect } from "next/navigation";
import { SocialOpsPanel } from "@/components/social-ops-panel";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "社媒运营 · OPS Alpha 后台",
  description: "X / 小红书内容池、文案复制、草稿与发布追踪",
};

export default async function AdminSocialPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login?redirect=/admin/social");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">Social Ops</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">社媒运营工作台</h1>
          <p className="mt-1 text-[13px] text-muted">
            聚焦 X + 小红书 · 自动 UTM · 评级/快讯/研报/价值链内容池
          </p>
        </div>
        <Link href="/admin" className="text-[12px] text-muted hover:text-accent-strong">
          ← 回到 Admin 首页
        </Link>
      </header>

      <SocialOpsPanel />
    </div>
  );
}
