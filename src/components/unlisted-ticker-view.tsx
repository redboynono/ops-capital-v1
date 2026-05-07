import Link from "next/link";
import { Globe2, ExternalLink } from "lucide-react";
import {
  fetchCompanyNews,
  fetchCompanyProfile,
  type FinnhubCompanyProfile,
  type FinnhubNewsItem,
  getQuote,
} from "@/lib/finnhub";

const exchangeShort: Record<string, string> = {
  "NEW YORK STOCK EXCHANGE, INC.": "NYSE",
  "NASDAQ NMS - GLOBAL MARKET": "NASDAQ",
  "NASDAQ/NGS (GLOBAL SELECT MARKET)": "NASDAQ",
  "NASDAQ GLOBAL MARKET": "NASDAQ",
};

function fmtMoney(n: number | null | undefined, currency = "USD"): string {
  if (n == null || !isFinite(n)) return "—";
  const sym = currency === "USD" ? "$" : "";
  if (n >= 1000) return `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `${sym}${n.toFixed(2)}`;
}

function fmtMcap(millions: number | null | undefined): string {
  if (millions == null || !isFinite(millions) || millions <= 0) return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(0)}M`;
}

/**
 * Fallback view for symbols that exist on Finnhub but are NOT in our
 * `tickers` table. Shows live profile + quote + 14-day news so the user
 * still gets value from the search even before we explicitly cover it.
 */
export async function UnlistedTickerView({
  symbol,
  isAdmin,
}: {
  symbol: string;
  isAdmin: boolean;
}) {
  // Pull live data in parallel
  const newsFrom = new Date();
  newsFrom.setUTCDate(newsFrom.getUTCDate() - 14);
  const newsTo = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const [profile, quote, news] = await Promise.all([
    fetchCompanyProfile(symbol),
    getQuote(symbol).catch(() => null),
    fetchCompanyNews(symbol, isoDate(newsFrom), isoDate(newsTo), 8).catch(() => [] as FinnhubNewsItem[]),
  ]);

  // If profile + quote both fail, the symbol is genuinely unknown
  if (!profile && (!quote || quote.c === 0)) {
    return (
      <div className="mx-auto w-full max-w-[800px] px-4 py-12 text-center">
        <p className="label-caps text-muted">Ticker not found</p>
        <h1 className="mt-2 text-2xl font-bold">"{symbol}" 未在任何市场找到</h1>
        <p className="mt-2 text-[13px] text-muted">
          请检查代码是否正确，或返回 <Link href="/tickers" className="text-accent-strong hover:underline">标的索引</Link>。
        </p>
      </div>
    );
  }

  const exShort = profile ? (exchangeShort[profile.exchange] ?? profile.exchange.split(",")[0]) : "—";
  const sector = profile?.finnhubIndustry ?? null;
  const change = quote?.dp ?? null;
  const changeClass =
    change == null ? "text-muted" : change > 0 ? "text-[color:var(--success)]" : change < 0 ? "text-[color:var(--danger)]" : "text-foreground";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/tickers" className="hover:text-accent-strong">标的索引</Link>
        <span className="mx-1">/</span>
        <span>{symbol}</span>
      </nav>

      {/* Live preview banner */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded border border-dashed border-accent/60 bg-accent/5 px-3 py-2 text-[12px]">
        <div className="flex items-center gap-2 text-accent-strong">
          <Globe2 className="h-4 w-4" strokeWidth={1.8} />
          <span className="font-mono font-semibold">UNLISTED</span>
          <span className="text-foreground-soft">
            该标的暂未收录·下方为来自 Finnhub 的实时市场数据预览（无评级·无历史）
          </span>
        </div>
        {isAdmin ? (
          <AdminAddButton
            symbol={symbol}
            name={profile?.name ?? symbol}
            exchange={exShort}
            sector={sector}
          />
        ) : null}
      </div>

      {/* Header */}
      <header className="mt-4 card p-4">
        <div className="flex flex-wrap items-start gap-3">
          {profile?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo} alt={symbol} className="h-12 w-12 rounded-sm border border-border bg-white object-contain p-1" />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-3xl font-bold text-foreground">{symbol}</h1>
              <span className="text-[13px] text-muted">{exShort}</span>
              {profile?.country ? (
                <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  {profile.country}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[15px] font-semibold text-foreground-soft">{profile?.name ?? "—"}</p>
            {sector ? <p className="mt-0.5 text-[12px] text-muted">行业：{sector}</p> : null}
            {profile?.weburl ? (
              <a
                href={profile.weburl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent-strong hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {new URL(profile.weburl).host.replace("www.", "")}
              </a>
            ) : null}
          </div>
        </div>

        {/* Quote strip */}
        <div className="mt-3 grid grid-cols-2 gap-3 rounded-sm border border-border bg-surface-muted p-3 md:grid-cols-4">
          <div>
            <p className="label-caps text-[10px]">现价</p>
            <p className="mt-0.5 font-mono text-[17px] font-bold">{fmtMoney(quote?.c, profile?.currency ?? "USD")}</p>
            <p className={`font-mono text-[11px] ${changeClass}`}>
              {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="label-caps text-[10px]">日内</p>
            <p className="mt-0.5 font-mono text-[13px]">
              {fmtMoney(quote?.l)} – {fmtMoney(quote?.h)}
            </p>
            <p className="font-mono text-[11px] text-muted">前收 {fmtMoney(quote?.pc)}</p>
          </div>
          <div>
            <p className="label-caps text-[10px]">市值</p>
            <p className="mt-0.5 font-mono text-[13px]">{fmtMcap(profile?.marketCapitalization)}</p>
            <p className="font-mono text-[11px] text-muted">
              {profile?.shareOutstanding ? `${profile.shareOutstanding.toFixed(0)}M shares` : "—"}
            </p>
          </div>
          <div>
            <p className="label-caps text-[10px]">IPO</p>
            <p className="mt-0.5 font-mono text-[13px]">{profile?.ipo || "—"}</p>
            <p className="font-mono text-[11px] text-muted">{profile?.currency ?? "USD"} 计价</p>
          </div>
        </div>
      </header>

      {/* News */}
      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-bold text-foreground-soft">
          近 14 天市场新闻
          <span className="ml-2 font-normal text-muted">· {news.length}</span>
        </h2>
        <div className="card divide-y divide-border">
          {news.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">该标的近期无市场新闻</p>
          ) : (
            news.map((n) => (
              <a
                key={`${n.id}-${n.datetime}`}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="row-hover block px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">
                      {n.headline}
                    </p>
                    {n.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{n.summary}</p>
                    ) : null}
                  </div>
                  {n.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.image} alt="" className="h-14 w-20 flex-shrink-0 rounded-sm object-cover" />
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted">
                  {n.source} · {new Date(n.datetime * 1000).toLocaleString("zh-CN", { hour12: false })}
                </p>
              </a>
            ))
          )}
        </div>
      </section>

      {/* Footer disclaimer */}
      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        免责声明：本页为 Finnhub 公开市场数据的只读预览，不构成投资建议。该标的尚未进入 Ops Alpha 评级覆盖范围。
      </p>
    </div>
  );
}

function AdminAddButton({
  symbol,
  name,
  exchange,
  sector,
}: {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
}) {
  return (
    <form action="/api/admin/tickers/add" method="POST" className="flex items-center">
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="exchange" value={exchange} />
      {sector ? <input type="hidden" name="sector" value={sector} /> : null}
      <button
        type="submit"
        className="rounded-sm border border-accent bg-accent px-2 py-1 font-mono text-[11px] font-bold text-white hover:bg-accent-strong"
      >
        + 加入索引
      </button>
    </form>
  );
}
