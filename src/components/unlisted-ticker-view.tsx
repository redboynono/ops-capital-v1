import Link from "next/link";
import { Globe2, ExternalLink } from "lucide-react";
import {
  fetchCompanyNews,
  fetchCompanyProfile,
  type FinnhubNewsItem,
} from "@/lib/finnhub";
import { getQuote } from "@/lib/quotes";
import { isHkStyleSymbol, normalizeInternalSymbol } from "@/lib/symbol-resolve";
import { getQuote as getYahooQuote, toYahooSymbol } from "@/lib/yahoo";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

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

export async function UnlistedTickerView({
  symbol,
  isAdmin,
}: {
  symbol: string;
  isAdmin: boolean;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const u = dict.unlistedTicker;
  const ms = dict.marketStats;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";

  const newsFrom = new Date();
  newsFrom.setUTCDate(newsFrom.getUTCDate() - 14);
  const newsTo = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const finnhubSymbol = isHkStyleSymbol(symbol) ? normalizeInternalSymbol(symbol) : symbol;

  const [profile, quote, news] = await Promise.all([
    isHkStyleSymbol(symbol) ? Promise.resolve(null) : fetchCompanyProfile(symbol).catch(() => null),
    getQuote(symbol).catch(() => null),
    isHkStyleSymbol(symbol)
      ? Promise.resolve([] as FinnhubNewsItem[])
      : fetchCompanyNews(finnhubSymbol, isoDate(newsFrom), isoDate(newsTo), 8).catch(
          () => [] as FinnhubNewsItem[],
        ),
  ]);

  const yahooSym = toYahooSymbol(symbol);
  let displayQuote = quote;
  let yahooName: string | null = null;
  if (!displayQuote?.c) {
    const yq = await getYahooQuote(yahooSym).catch(() => null);
    if (yq?.c) {
      displayQuote = yq;
      yahooName = yq.shortName;
    }
  }

  if (!profile && (!displayQuote || displayQuote.c === 0)) {
    return (
      <div className="mx-auto w-full max-w-[800px] px-4 py-12 text-center">
        <p className="label-caps text-muted">{u.notFoundLabel}</p>
        <h1 className="mt-2 text-2xl font-bold">{fmt(u.notFoundTitleFmt, { symbol })}</h1>
        <p className="mt-2 text-[13px] text-muted">
          {u.notFoundBodyPrefix} <span className="font-mono">00700</span>
          {u.notFoundBodyMid} <span className="font-mono">0700.HK</span>
          {u.notFoundBodySuffix}{" "}
          <Link href="/tickers" className="text-accent-strong hover:underline">
            {u.breadcrumb}
          </Link>
          {u.notFoundEnd}
        </p>
      </div>
    );
  }

  const exShort = profile
    ? (exchangeShort[profile.exchange] ?? profile.exchange.split(",")[0])
    : isHkStyleSymbol(symbol)
      ? "HKEX"
      : "—";
  const sector = profile?.finnhubIndustry ?? null;
  const change = displayQuote?.dp ?? null;
  const displayName = profile?.name ?? yahooName ?? symbol;
  const changeClass =
    change == null ? "text-muted" : change > 0 ? "text-[color:var(--success)]" : change < 0 ? "text-[color:var(--danger)]" : "text-foreground";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/tickers" className="hover:text-accent-strong">{u.breadcrumb}</Link>
        <span className="mx-1">/</span>
        <span>{symbol}</span>
      </nav>

      <div className="mt-3 flex items-center justify-between gap-3 rounded border border-dashed border-accent/60 bg-accent/5 px-3 py-2 text-[12px]">
        <div className="flex items-center gap-2 text-accent-strong">
          <Globe2 className="h-4 w-4" strokeWidth={1.8} />
          <span className="font-mono font-semibold">UNLISTED</span>
          <span className="text-foreground-soft">{u.bannerHint}</span>
        </div>
        {isAdmin ? (
          <AdminAddButton
            symbol={symbol}
            name={profile?.name ?? symbol}
            exchange={exShort}
            sector={sector}
            label={u.adminAdd}
          />
        ) : null}
      </div>

      <header className="mt-4 card p-4">
        <div className="flex flex-wrap items-start gap-3">
          {profile?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo} alt={symbol} className="h-12 w-12 rounded-sm border border-border bg-white object-contain p-1" />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-3xl font-bold text-foreground">
                {isHkStyleSymbol(symbol) ? yahooSym : symbol}
              </h1>
              {isHkStyleSymbol(symbol) && yahooSym !== symbol ? (
                <span className="font-mono text-[12px] text-muted">{fmt(u.inDbFmt, { symbol })}</span>
              ) : null}
              <span className="text-[13px] text-muted">{exShort}</span>
              {profile?.country ? (
                <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                  {profile.country}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[15px] font-semibold text-foreground-soft">{displayName}</p>
            {sector ? <p className="mt-0.5 text-[12px] text-muted">{fmt(u.sectorFmt, { sector })}</p> : null}
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

        <div className="mt-3 grid grid-cols-2 gap-3 rounded-sm border border-border bg-surface-muted p-3 md:grid-cols-4">
          <div>
            <p className="label-caps text-[10px]">{ms.price}</p>
            <p className="mt-0.5 font-mono text-[17px] font-bold">
              {fmtMoney(displayQuote?.c, profile?.currency ?? (isHkStyleSymbol(symbol) ? "HKD" : "USD"))}
            </p>
            <p className={`font-mono text-[11px] ${changeClass}`}>
              {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="label-caps text-[10px]">{ms.intraday}</p>
            <p className="mt-0.5 font-mono text-[13px]">
              {fmtMoney(displayQuote?.l)} – {fmtMoney(displayQuote?.h)}
            </p>
            <p className="font-mono text-[11px] text-muted">
              {fmt(ms.prevCloseFmt, { price: fmtMoney(displayQuote?.pc) })}
            </p>
          </div>
          <div>
            <p className="label-caps text-[10px]">{ms.marketCap}</p>
            <p className="mt-0.5 font-mono text-[13px]">{fmtMcap(profile?.marketCapitalization)}</p>
            <p className="font-mono text-[11px] text-muted">
              {profile?.shareOutstanding ? `${profile.shareOutstanding.toFixed(0)}M shares` : "—"}
            </p>
          </div>
          <div>
            <p className="label-caps text-[10px]">IPO</p>
            <p className="mt-0.5 font-mono text-[13px]">{profile?.ipo || "—"}</p>
            <p className="font-mono text-[11px] text-muted">
              {fmt(u.currencyFmt, { currency: profile?.currency ?? "USD" })}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-bold text-foreground-soft">
          {u.news14d}
          <span className="ml-2 font-normal text-muted">· {news.length}</span>
        </h2>
        <div className="card divide-y divide-border">
          {news.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">{u.noNews}</p>
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
                  {n.source} · {new Date(n.datetime * 1000).toLocaleString(dateLocale, { hour12: false })}
                </p>
              </a>
            ))
          )}
        </div>
      </section>

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        {u.disclaimer}
      </p>
    </div>
  );
}

function AdminAddButton({
  symbol,
  name,
  exchange,
  sector,
  label,
}: {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  label: string;
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
        {label}
      </button>
    </form>
  );
}
