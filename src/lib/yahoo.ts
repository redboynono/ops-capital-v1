/**
 * Yahoo Finance unofficial quote helper (no API key, free, wide coverage).
 * Uses v8/finance/chart which is the same endpoint finance.yahoo.com itself uses.
 *
 * Supports:
 *  - US stocks:              NVDA, TSLA, AAPL, ...
 *  - Indices:                ^GSPC, ^IXIC, ^DJI, ^HSI, ^NDX, 000001.SS, ...
 *  - Crypto:                 BTC-USD, ETH-USD, SOL-USD, ...
 *  - HK equities:            0700.HK, 3690.HK, 9988.HK
 *  - A-shares:               600519.SS (Shanghai), 000001.SZ (Shenzhen)
 *  - Forex:                  USDCNY=X, USDJPY=X
 */

export type YahooQuote = {
  symbol: string;
  displaySymbol: string;
  c: number;   // current price
  d: number | null;   // absolute change
  dp: number | null;  // change percent
  h: number;
  l: number;
  o: number;
  pc: number;  // previous close
  t: number;
  currency: string;
  shortName: string | null;
  stale: boolean;
};

type CacheEntry = { at: number; data: YahooQuote | null };

const CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 1000;

function displayOf(symbol: string): string {
  // ^GSPC → S&P 500 keep raw; BTC-USD → BTC; 0700.HK → 0700
  const m1 = symbol.match(/^([A-Z]+)-USD$/);
  if (m1) return m1[1];
  const m2 = symbol.match(/^(\d+)\.HK$/);
  if (m2) return m2[1];
  return symbol;
}

async function fetchOne(symbol: string): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        Accept: "application/json,text/plain,*/*",
      },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: {
        error?: unknown;
        result?: Array<{
          meta?: {
            symbol?: string;
            currency?: string;
            shortName?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketTime?: number;
          };
        }>;
      };
    };
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta || j?.chart?.error) return null;
    const c = Number(meta.regularMarketPrice ?? 0);
    const pc = Number(meta.chartPreviousClose ?? meta.previousClose ?? 0);
    if (!c) return null;
    const d = pc ? c - pc : null;
    const dp = pc ? ((c - pc) / pc) * 100 : null;
    return {
      symbol,
      displaySymbol: displayOf(symbol),
      c,
      d,
      dp,
      h: Number(meta.regularMarketDayHigh ?? 0),
      l: Number(meta.regularMarketDayLow ?? 0),
      o: 0,
      pc,
      t: Number(meta.regularMarketTime ?? 0),
      currency: meta.currency ?? "USD",
      shortName: meta.shortName ?? null,
      stale: false,
    };
  } catch {
    return null;
  }
}

export async function getQuotes(
  symbols: string[],
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Record<string, YahooQuote | null>> {
  const now = Date.now();
  const toFetch: string[] = [];
  const result: Record<string, YahooQuote | null> = {};

  for (const sym of symbols) {
    const cached = CACHE.get(sym);
    if (cached && now - cached.at < ttlMs) {
      result[sym] = cached.data;
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    const fetched = await Promise.all(
      toFetch.map(async (s) => [s, await fetchOne(s)] as const),
    );
    for (const [sym, data] of fetched) {
      CACHE.set(sym, { at: now, data });
      result[sym] = data;
    }
  }

  return result;
}

export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  const map = await getQuotes([symbol]);
  return map[symbol];
}

// =====================================================================
// Symbol mapping & fundamentals (v10 quoteSummary, requires crumb)
// =====================================================================

/**
 * Convert our internal symbol to Yahoo format.
 *  - 5-digit HK code → 0700.HK style
 *  - everything else returned as-is
 */
export function toYahooSymbol(internal: string): string {
  if (/^\d{4,5}$/.test(internal)) {
    const n = String(parseInt(internal, 10)).padStart(4, "0");
    return `${n}.HK`;
  }
  return internal;
}

export function isHkSymbol(internal: string): boolean {
  return /^\d{4,5}$/.test(internal);
}

// ---- crumb cache ---------------------------------------------------
type CrumbState = { crumb: string; cookie: string; at: number };
let CRUMB: CrumbState | null = null;
const CRUMB_TTL_MS = 12 * 60 * 60 * 1000; // 12h

async function getCrumb(): Promise<CrumbState | null> {
  const now = Date.now();
  if (CRUMB && now - CRUMB.at < CRUMB_TTL_MS) return CRUMB;
  try {
    // Step 1: hit fc.yahoo.com to acquire A1/A1S/B cookies
    const res1 = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "manual",
    }).catch(() => null);
    const setCookies = res1?.headers.getSetCookie?.() ?? [];
    const cookie = setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");

    // Step 2: ask for crumb (some regions return crumb even without cookies)
    const res2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (!res2.ok) return null;
    const crumb = (await res2.text()).trim();
    if (!crumb || crumb.length > 64) return null;
    CRUMB = { crumb, cookie, at: now };
    return CRUMB;
  } catch {
    return null;
  }
}

type RawNum = { raw?: number } | null | undefined;
function rawOf(v: RawNum): number | null {
  if (v && typeof v === "object" && typeof v.raw === "number" && Number.isFinite(v.raw)) {
    return v.raw;
  }
  return null;
}

export type YahooFundamentals = {
  // Price/return
  price: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekChange: number | null; // fraction, e.g. 0.32 = +32%
  // Valuation
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  // Profitability
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  // Growth
  revenueGrowth: number | null; // YoY fraction
  earningsGrowth: number | null;
  // Risk
  beta: number | null;
  marketCap: number | null;
  dividendYield: number | null;
  // Analyst consensus
  targetMeanPrice: number | null;
  recommendationMean: number | null; // 1=Strong Buy, 5=Sell
  numberOfAnalystOpinions: number | null;
  // Meta
  shortName: string | null;
  currency: string | null;
};

export async function fetchYahooFundamentals(yahooSymbol: string): Promise<YahooFundamentals | null> {
  const crumbState = await getCrumb();
  if (!crumbState) return null;

  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}` +
    `?modules=summaryDetail,financialData,defaultKeyStatistics,price&crumb=${encodeURIComponent(crumbState.crumb)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(crumbState.cookie ? { Cookie: crumbState.cookie } : {}),
      },
    });
    if (!res.ok) {
      // crumb may have expired; bust cache and let next call retry
      if (res.status === 401) CRUMB = null;
      return null;
    }
    const j = (await res.json()) as {
      quoteSummary?: { result?: Array<Record<string, Record<string, unknown>>>; error?: unknown };
    };
    const r = j?.quoteSummary?.result?.[0];
    if (!r) return null;

    const sd = (r.summaryDetail ?? {}) as Record<string, RawNum>;
    const fd = (r.financialData ?? {}) as Record<string, RawNum>;
    const ks = (r.defaultKeyStatistics ?? {}) as Record<string, RawNum>;
    const p = (r.price ?? {}) as Record<string, unknown>;

    return {
      price: rawOf((p.regularMarketPrice ?? null) as RawNum),
      fiftyTwoWeekHigh: rawOf(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: rawOf(sd.fiftyTwoWeekLow),
      fiftyTwoWeekChange: rawOf(ks["52WeekChange"]),
      trailingPE: rawOf(sd.trailingPE),
      forwardPE: rawOf(ks.forwardPE),
      priceToBook: rawOf(ks.priceToBook),
      priceToSales: rawOf(sd.priceToSalesTrailing12Months),
      grossMargins: rawOf(fd.grossMargins),
      operatingMargins: rawOf(fd.operatingMargins),
      profitMargins: rawOf(ks.profitMargins),
      returnOnEquity: rawOf(fd.returnOnEquity),
      revenueGrowth: rawOf(fd.revenueGrowth),
      earningsGrowth: rawOf(fd.earningsGrowth),
      beta: rawOf(ks.beta),
      marketCap: rawOf(sd.marketCap),
      dividendYield: rawOf(sd.dividendYield),
      targetMeanPrice: rawOf(fd.targetMeanPrice),
      recommendationMean: rawOf(fd.recommendationMean),
      numberOfAnalystOpinions: rawOf(fd.numberOfAnalystOpinions),
      shortName: typeof p.shortName === "string" ? p.shortName : null,
      currency: typeof p.currency === "string" ? p.currency : null,
    };
  } catch {
    return null;
  }
}

/**
 * Map Yahoo fundamentals → the same key set our Finnhub `metric` map uses,
 * so the existing ratings prompt's pickMetrics() works unchanged.
 *
 * Note: Yahoo returns margin/growth as *fractions* (0.31 = 31%), Finnhub returns
 * them as *percentages*. We multiply by 100 to align.
 */
export function yahooToFinnhubMetric(y: YahooFundamentals): Record<string, number> {
  const out: Record<string, number> = {};
  const setIf = (k: string, v: number | null, mult = 1) => {
    if (v != null && Number.isFinite(v)) out[k] = v * mult;
  };
  setIf("peNormalizedAnnual", y.trailingPE);
  setIf("peBasicExclExtraTTM", y.trailingPE);
  setIf("pbAnnual", y.priceToBook);
  setIf("psAnnual", y.priceToSales);
  setIf("epsGrowthTTMYoy", y.earningsGrowth, 100);
  setIf("revenueGrowthTTMYoy", y.revenueGrowth, 100);
  setIf("grossMarginTTM", y.grossMargins, 100);
  setIf("operatingMarginTTM", y.operatingMargins, 100);
  setIf("roeTTM", y.returnOnEquity, 100);
  setIf("52WeekHigh", y.fiftyTwoWeekHigh);
  setIf("52WeekLow", y.fiftyTwoWeekLow);
  setIf("52WeekPriceReturnDaily", y.fiftyTwoWeekChange, 100);
  setIf("beta", y.beta);
  if (y.marketCap != null) out["marketCapitalization"] = y.marketCap / 1e6; // → $M
  setIf("dividendYieldIndicatedAnnual", y.dividendYield, 100);
  return out;
}
