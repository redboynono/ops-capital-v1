import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
        <p className="mt-2 text-[13px] text-muted">
          请将你的邮箱加入 <code>ADMIN_EMAILS</code> 环境变量后重新登录。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Admin</span>
        <h1 className="mt-1 text-2xl font-bold">Ops Alpha 后台</h1>
        <p className="mt-1 text-[13px] text-muted">当前登录：{auth.user.email}</p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/editor" className="card p-4 hover:border-accent">
          <p className="label-caps">AI 编辑器</p>
          <h2 className="mt-1 text-lg font-bold">生成与发布内容</h2>
          <p className="mt-1 text-[13px] text-muted">一键生成分析 / 快讯草稿，绑定 tickers 后入库。</p>
        </Link>
        <Link href="/admin/ratings" className="card p-4 hover:border-accent">
          <p className="label-caps">OPS Rating</p>
          <h2 className="mt-1 text-lg font-bold">评级管理</h2>
          <p className="mt-1 text-[13px] text-muted">手填或 AI 一键生成 Factor Grades、Quant Score、目标价。</p>
        </Link>
        <Link href="/admin/picks" className="card p-4 hover:border-accent">
          <p className="label-caps">OPS Picks</p>
          <h2 className="mt-1 text-lg font-bold">OPS 精选</h2>
          <p className="mt-1 text-[13px] text-muted">发布 / 平仓 / 止损 Picks，前台自动计算实时收益 + 组合绩效。</p>
        </Link>
        <Link href="/admin/conviction" className="card p-4 hover:border-accent">
          <p className="label-caps">OPS Rankings</p>
          <h2 className="mt-1 text-lg font-bold">OPS 榜单</h2>
          <p className="mt-1 text-[13px] text-muted">创建月度榜单，添加 picks，公开页实时跟踪净值。</p>
        </Link>
        <Link href="/admin/earnings" className="card p-4 hover:border-accent">
          <p className="label-caps">Earnings Pipeline</p>
          <h2 className="mt-1 text-lg font-bold">财报流水线</h2>
          <p className="mt-1 text-[13px] text-muted">覆盖标的财报自动触发深度文章生成，支持手动扫描 + 重试失败。</p>
        </Link>
        <Link href="/admin/ops" className="card p-4 hover:border-accent">
          <p className="label-caps">Ops 监控</p>
          <h2 className="mt-1 text-lg font-bold">运行健康面板</h2>
          <p className="mt-1 text-[13px] text-muted">cron 状态 / 数据新鲜度 / 用户漏斗 / 事件趋势 / 失败列表。</p>
        </Link>
        <Link href="/admin/posts" className="card p-4 hover:border-accent">
          <p className="label-caps">内容库</p>
          <h2 className="mt-1 text-lg font-bold">文章管理</h2>
          <p className="mt-1 text-[13px] text-muted">列表编辑、批量发布 / 下架。</p>
        </Link>
      </div>
    </div>
  );
}
