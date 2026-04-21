import Link from "next/link";
import { redirect } from "next/navigation";
import { AddToWatchlistForm, RemoveFromWatchlistButton } from "@/components/add-to-watchlist-form";
import { getSessionUser } from "@/lib/auth";
import { listWatchlist } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const items = await listWatchlist(user.id);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Watchlist</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">我的自选股</h1>
        <p className="mt-1 text-[13px] text-muted">手动输入标的代码加入自选，后续接入实时行情。</p>
      </header>

      <div className="mb-4">
        <AddToWatchlistForm />
      </div>

      <section className="card">
        {items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted">
            尚未添加自选。试试 NVDA、TSLA、BTC 或 00700。
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li key={t.symbol} className="row-hover flex items-center justify-between px-4 py-2.5">
                <div className="flex items-baseline gap-3">
                  <Link
                    href={`/t/${t.symbol}`}
                    className="font-mono text-[14px] font-bold text-accent-strong hover:underline"
                  >
                    {t.symbol}
                  </Link>
                  <span className="text-[13px] text-foreground">{t.name}</span>
                  <span className="text-[11px] text-muted">{t.exchange}</span>
                </div>
                <RemoveFromWatchlistButton symbol={t.symbol} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
