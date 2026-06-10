import { redirect } from "next/navigation";
import { AddToWatchlistForm } from "@/components/add-to-watchlist-form";
import { WatchlistTable } from "@/components/watchlist-table";
import { getSessionUser } from "@/lib/auth";
import { listWatchlistWithRatings } from "@/lib/tickers";
import type { Verdict } from "@/lib/ratings";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const items = await listWatchlistWithRatings(user.id);

  const rows = items.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    exchange: t.exchange,
    quant_score: t.quant_score,
    ops_verdict: (t.ops_verdict as Verdict | null) ?? null,
    rank_overall: t.rank_overall,
  }));

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Watchlist</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">我的自选股</h1>
        <p className="mt-1 text-[13px] text-muted">
          近实时行情 · OPS Quant 分与评级 · 每 60 秒刷新
        </p>
      </header>

      <div className="mb-4">
        <AddToWatchlistForm />
      </div>

      {rows.length === 0 ? (
        <section className="card">
          <p className="py-12 text-center text-[13px] text-muted">
            尚未添加自选。试试 NVDA、TSLA、0700 或 BTC。
          </p>
        </section>
      ) : (
        <WatchlistTable rows={rows} />
      )}
    </div>
  );
}
