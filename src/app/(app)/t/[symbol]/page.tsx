import Link from "next/link";
import { redirect } from "next/navigation";
import { AgentLauncher, type AgentCardData } from "@/components/agent-launcher";
import { PostRow } from "@/components/post-row";
import { FactorGrades, QuantRanking, RatingsSummary } from "@/components/rating-panels";
import { UnlistedTickerView } from "@/components/unlisted-ticker-view";
import { QuickAddPosition } from "@/components/quick-add-position";
import { WatchlistToggle } from "@/components/watchlist-toggle";
import { isAdminEmail } from "@/lib/admin";
import { AskAI } from "@/components/ask-ai";
import { listAgentsByInput } from "@/lib/agents/registry";
import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";
import { listPosts } from "@/lib/posts";
import { OptionTradeIdeasPanel } from "@/components/option-trade-ideas-panel";
import { SentimentStrip } from "@/components/sentiment-strip";
import { TickerMarketStats } from "@/components/ticker-market-stats";
import { isUsEquityTicker } from "@/lib/polygon";
import { thisFridayIso } from "@/lib/options-expiry";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";
import { getTickerBySymbol, listRelatedTickers } from "@/lib/tickers";

export const dynamic = "force-dynamic";

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
  const decoded = decodeURIComponent(raw).trim().toUpperCase();
  const symbol = normalizeInternalSymbol(decoded);
  if (symbol !== decoded) {
    redirect(`/t/${encodeURIComponent(symbol)}`);
  }
  const ticker = await getTickerBySymbol(symbol);

  if (ticker && ticker.symbol !== symbol) {
    redirect(`/t/${encodeURIComponent(ticker.symbol)}`);
  }

  // Unlisted: fall back to live market preview (Yahoo 覆盖港股 .HK 写法)
  if (!ticker) {
    const u = await getSessionUser();
    return <UnlistedTickerView symbol={symbol} isAdmin={isAdminEmail(u?.email)} />;
  }

  const { tab } = await searchParams;
  const active = tab === "news" ? "news" : "analysis";
  const locale = await getLocale();
  const tk = getDictionary(locale).ticker;
  const exchangeLabels = tk.exchanges;

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
        <Link href="/tickers" className="hover:text-accent-strong">{tk.breadcrumb}</Link>
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
                {(exchangeLabels as Record<string, string>)[ticker.exchange] ?? ticker.exchange}
              </span>
            </div>
            <p className="mt-1 text-[15px] font-semibold text-foreground-soft">{ticker.name}</p>
            {ticker.sector ? (
              <p className="mt-0.5 text-[12px] text-muted">{fmt(tk.sectorFmt, { sector: ticker.sector })}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WatchlistToggle symbol={symbol} initialInWatchlist={inWatchlist} />
            <QuickAddPosition symbol={symbol} loggedIn={Boolean(user)} />
          </div>
        </div>
        <TickerMarketStats symbol={symbol} />
        {isUsEquityTicker(symbol) ? <SentimentStrip symbol={symbol} /> : null}
        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
          <span>
            {fmt(tk.articlesFmt, { analysis: analysis.length, news: news.length })}
          </span>
        </div>
      </header>

      {isUsEquityTicker(symbol) ? (
        <div className="mt-5">
          <OptionTradeIdeasPanel
            symbol={symbol}
            expirationDate={thisFridayIso()}
            expiryLabel={tk.expiryThisFriday}
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
        <section>
          <div className="flex items-center border-b border-border">
            <Link href={`/t/${symbol}?tab=analysis`} className={tabClass("analysis")}>
              {tk.tabAnalysis} · {analysis.length}
            </Link>
            <Link href={`/t/${symbol}?tab=news`} className={tabClass("news")}>
              {tk.tabNews} · {news.length}
            </Link>
          </div>

          <div className="card mt-3 px-4">
            {items.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted">
                {active === "analysis" ? tk.noPostsAnalysis : tk.noPostsNews}
              </p>
            ) : (
              items.map((p) => <PostRow key={p.id} post={p} locale={locale} />)
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
              {tk.adminEditRating}
            </Link>
          ) : null}

          <section className="card p-3">
            <p className="label-caps">{tk.relatedTickers}</p>
            <ul className="mt-2 space-y-1">
              {related.length === 0 ? (
                <li className="text-[12px] text-muted">{tk.noRelated}</li>
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

      <AgentLauncher
        symbol={symbol}
        loggedIn={Boolean(user)}
        agents={listAgentsByInput("ticker").map<AgentCardData>((a) => ({
          id: a.id,
          name: a.name,
          emoji: a.emoji,
          category: a.category,
          short: a.short,
          description: a.description,
          estimatedSeconds: a.estimatedSeconds,
        }))}
      />

      <AskAI
        context={{ kind: "ticker", symbol }}
        loggedIn={Boolean(user)}
      />
    </div>
  );
}
