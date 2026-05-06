import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { mysqlQuery } from "@/lib/mysql";
import { listAllTickers } from "@/lib/tickers";

export const dynamic = "force-dynamic";

type RatedRow = { symbol: string; quant_score: string | null; ops_verdict: string | null; updated_at: string; last_refreshed_at: string | null };

function formatAge(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

export default async function AdminRatingsIndex() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const [tickers, rated] = await Promise.all([
    listAllTickers(),
    mysqlQuery<RatedRow[]>(
      "select symbol, quant_score, ops_verdict, updated_at, last_refreshed_at from ticker_ratings",
    ),
  ]);
  const ratedMap = new Map(rated.map((r) => [r.symbol, r]));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <span>评级管理</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">OPS Rating</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">评级管理</h1>
        <p className="mt-1 text-[13px] text-muted">
          选一个标的进入编辑页，可手填或一键 AI 生成。已覆盖 {rated.length} / {tickers.length} 个标的。
        </p>
      </header>

      <div className="card divide-y divide-border">
        {tickers.map((t) => {
          const r = ratedMap.get(t.symbol);
          const hasRating = !!r;
          return (
            <Link
              key={t.symbol}
              href={`/admin/ratings/${t.symbol}`}
              className="row-hover flex items-center gap-4 px-4 py-2.5 text-[13px]"
            >
              <span className="w-20 font-mono font-bold text-accent-strong">{t.symbol}</span>
              <span className="flex-1 truncate text-foreground-soft">{t.name}</span>
              <span className="hidden w-20 text-[11px] text-muted md:inline">{t.exchange}</span>
              {hasRating ? (
                <>
                  <span className="w-16 font-mono text-[12px] text-foreground">{r?.ops_verdict ?? "—"}</span>
                  <span className="w-12 text-right font-mono font-bold text-accent-strong">
                    {r?.quant_score ? Number(r.quant_score).toFixed(2) : "—"}
                  </span>
                  <span className="w-24 text-right font-mono text-[11px] text-muted" title="上次刷新">
                    {formatAge(r?.last_refreshed_at ?? r?.updated_at ?? null)}
                  </span>
                </>
              ) : (
                <span className="w-28 text-right text-[11px] font-mono text-muted">未评级</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
