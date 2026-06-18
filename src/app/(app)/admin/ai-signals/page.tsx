import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getEditionById, listEditions } from "@/lib/ai-signals";
import { AdminAiSignalsActions } from "@/components/admin-ai-signals-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI 周选 · Admin",
};

export default async function AdminAiSignalsPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login?redirect=/admin/ai-signals");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const editions = await listEditions(20);
  const latestDraft = editions.find((e) => e.status === "draft");
  const draftDetail = latestDraft ? await getEditionById(latestDraft.id) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">
          后台
        </Link>
        <span className="mx-1">/</span>
        <span>AI 周选</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">AI Weekly Signals</span>
        <h1 className="mt-1 text-2xl font-bold">AI 周选 管理</h1>
        <p className="mt-1 text-[13px] text-muted">量化预筛 → AI 生成 → admin 发布 → Pro 邮件</p>
      </header>

      <section className="card mb-4 p-4">
        <AdminAiSignalsActions editions={editions} />
      </section>

      {draftDetail && draftDetail.signals.length > 0 ? (
        <section className="card mb-4 p-4">
          <h2 className="text-[13px] font-bold">
            本周 draft 预览 · {draftDetail.edition_date.slice(0, 10)} · {draftDetail.signals.length} 只
          </h2>
          <div className="mt-3 divide-y divide-border">
            {draftDetail.signals.map((s) => (
              <div key={s.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/t/${s.ticker_symbol}`} className="font-mono text-[14px] font-bold text-accent-strong">
                    {s.ticker_symbol}
                  </Link>
                  <span className="text-[11px] text-muted">
                    OPS {s.ops_verdict} · {s.ops_score?.toFixed(2)} · {s.conviction}
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-semibold">{s.headline}</p>
                <p className="mt-1 line-clamp-2 text-[12px] text-muted">{s.reason_teaser}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="grid grid-cols-[100px_80px_120px_120px_1fr] gap-3 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <span>周次</span>
          <span>状态</span>
          <span>发布时间</span>
          <span>邮件</span>
          <span>操作</span>
        </div>
        <div className="divide-y divide-border">
          {editions.length === 0 ? (
            <p className="px-3 py-6 text-[13px] text-muted">尚无 edition，点上方「生成本周 draft」</p>
          ) : (
            editions.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-[100px_80px_120px_120px_1fr] items-center gap-3 px-3 py-2 text-[12px]"
              >
                <span className="font-mono">{String(e.edition_date).slice(0, 10)}</span>
                <span className={e.status === "published" ? "text-[color:var(--success)]" : "text-muted"}>
                  {e.status === "published" ? "已发布" : "draft"}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {e.published_at ? new Date(e.published_at).toISOString().slice(0, 16).replace("T", " ") : "—"}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {e.email_sent_at ? "已发" : "—"}
                </span>
                <span>
                  {e.status === "published" ? (
                    <Link href={`/signals?week=${String(e.edition_date).slice(0, 10)}`} className="text-accent-strong hover:underline">
                      前台预览
                    </Link>
                  ) : (
                    <span className="text-muted">待发布</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
