import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { listAllPicks } from "@/lib/picks";

export const dynamic = "force-dynamic";

export default async function AdminPicksList() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const picks = await listAllPicks();

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <span>OPS Picks 管理</span>
      </nav>

      <header className="mt-3 mb-4 flex items-end justify-between border-b border-border pb-3">
        <div>
          <span className="label-caps">OPS Picks</span>
          <h1 className="mt-1 text-2xl font-bold">月度精选荐股管理</h1>
          <p className="mt-1 text-[13px] text-muted">
            共 {picks.length} 条 · 开仓 {picks.filter((p) => p.status === "open").length} · 已平仓 {picks.filter((p) => p.status !== "open").length}
          </p>
        </div>
        <Link href="/admin/picks/new" className="btn-primary px-4 py-1.5 text-[13px]">
          + 新建 Pick
        </Link>
      </header>

      {picks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[14px] text-muted">还没有任何 Pick。点右上角「新建 Pick」开始。</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_80px_90px_80px_80px_80px] gap-3 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span>代码</span>
            <span>标题</span>
            <span className="text-right">入场价</span>
            <span className="text-right">入场日期</span>
            <span className="text-right">状态</span>
            <span className="text-right">发布</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-border">
            {picks.map((p) => (
              <div key={p.id} className="grid grid-cols-[80px_1fr_80px_90px_80px_80px_80px] items-center gap-3 px-3 py-2 text-[12px]">
                <Link href={`/t/${p.ticker_symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                  {p.ticker_symbol}
                </Link>
                <Link href={`/admin/picks/${p.id}`} className="truncate text-foreground-soft hover:text-accent-strong">
                  {p.title}
                </Link>
                <span className="font-mono text-right">{p.entry_price.toFixed(2)}</span>
                <span className="font-mono text-right text-muted">
                  {new Date(p.entry_date).toISOString().slice(0, 10)}
                </span>
                <span className={`text-right font-semibold ${
                  p.status === "open"
                    ? "text-[color:var(--success)]"
                    : p.status === "stopped"
                      ? "text-[color:var(--danger)]"
                      : "text-muted"
                }`}>
                  {p.status === "open" ? "开仓" : p.status === "stopped" ? "止损" : "已平"}
                </span>
                <span className={`text-right ${p.is_published ? "text-foreground" : "text-muted"}`}>
                  {p.is_published ? "已发布" : "草稿"}
                </span>
                <span className="text-right">
                  <Link
                    href={`/admin/picks/${p.id}`}
                    className="mono text-[11px] text-accent-strong hover:underline"
                  >
                    编辑
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
