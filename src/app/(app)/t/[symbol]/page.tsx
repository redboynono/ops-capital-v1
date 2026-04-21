import Link from "next/link";
import { notFound } from "next/navigation";
import { PostRow } from "@/components/post-row";
import { FactorGrades, QuantRanking, RatingsSummary } from "@/components/rating-panels";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { isAdminEmail } from "@/lib/admin";
import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";
import { listPosts } from "@/lib/posts";
import { getTickerBySymbol, listRelatedTickers } from "@/lib/tickers";

export const dynamic = "force-dynamic";

const exchangeLabels: Record<string, string> = {
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  HKEX: "港交所",
  SSE: "上交所",
  SZSE: "深交所",
  CRYPTO: "加密",
  OTHER: "OTC",
};

async function isInWatchlist(userId: string, symbol: string) {
  const rows = await mysqlQuery<{ user_id: string }[]>(
    "select user_id from watchlist where user_id = ? and symbol = ? limit 1",
    [userId, symbol],
  );
  return rows.length > 0;
}

export default async function TickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) notFound();

  const { tab } = await searchParams;
  const active = tab === "news" ? "news" : "analysis";

  const [analysis, news, related, user] = await Promise.all([
    listPosts({ kind: "analysis", symbol, limit: 50 }),
    listPosts({ kind: "news", symbol, limit: 50 }),
    listRelatedTickers(symbol, ticker.sector),
    getSessionUser(),
  ]);

  const inWatchlist = user ? await isInWatchlist(user.id, symbol) : false;
  const items = active === "analysis" ? analysis : news;

  const tabClass = (key: "analysis" | "news") =>
    `px-3 py-1.5 text-[13px] font-semibold border-b-2 transition -mb-px ${
      active === key
        ? "border-accent text-accent-strong"
        : "border-transparent text-muted hover:text-foreground"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/tickers" className="hover:text-accent-strong">标的索引</Link>
        <span className="mx-1">/</span>
        <span>{symbol}</span>
      </nav>

      {/* 顶卡 */}
      <header className="mt-3 card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-3xl font-bold text-foreground">{ticker.symbol}</h1>
              <span className="text-[13px] text-muted">
                {exchangeLabels[ticker.exchange] ?? ticker.exchange}
              </span>
            </div>
            <p className="mt-1 text-[15px] font-semibold text-foreground-soft">{ticker.name}</p>
            {ticker.sector ? (
              <p className="mt-0.5 text-[12px] text-muted">行业：{ticker.sector}</p>
            ) : null}
          </div>
          <WatchlistToggle symbol={symbol} initialInWatchlist={inWatchlist} />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
          <span>
            本标的文章：<span className="font-mono font-bold text-foreground">{analysis.length}</span> 分析 ·
            <span className="ml-1 font-mono font-bold text-foreground">{news.length}</span> 快讯
          </span>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
        <section>
          <div className="flex items-center border-b border-border">
            <Link href={`/t/${symbol}?tab=analysis`} className={tabClass("analysis")}>
              分析 · {analysis.length}
            </Link>
            <Link href={`/t/${symbol}?tab=news`} className={tabClass("news")}>
              快讯 · {news.length}
            </Link>
          </div>

          <div className="card mt-3 px-4">
            {items.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted">
                该标的暂无{active === "analysis" ? "分析" : "快讯"}。
              </p>
            ) : (
              items.map((p) => <PostRow key={p.id} post={p} />)
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <RatingsSummary symbol={symbol} />
          <FactorGrades symbol={symbol} />
          <QuantRanking symbol={symbol} />

          {user && isAdminEmail(user.email) ? (
            <Link
              href={`/admin/ratings/${symbol}`}
              className="block rounded-sm border border-accent/40 bg-accent/10 px-3 py-2 text-center text-[11px] font-mono font-bold text-accent-strong hover:bg-accent/20"
            >
              ⚙ 编辑 / AI 生成 评级
            </Link>
          ) : null}

          <section className="card p-3">
            <p className="label-caps">相关标的</p>
            <ul className="mt-2 space-y-1">
              {related.length === 0 ? (
                <li className="text-[12px] text-muted">暂无同行业标的。</li>
              ) : (
                related.map((t) => (
                  <li key={t.symbol}>
                    <Link
                      href={`/t/${t.symbol}`}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-[13px] row-hover"
                    >
                      <span className="font-mono font-semibold text-accent-strong">{t.symbol}</span>
                      <span className="truncate text-[12px] text-muted">{t.name}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
