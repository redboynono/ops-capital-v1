/**
 * Finnhub quote helper with in-memory TTL cache.
 *
 * Free tier (60 req/min) covers US stocks + crypto (BINANCE:BTCUSDT format).
 * HK / A-share / price-target / company-news require a paid plan.
 */

export type FinnhubQuote = {
  symbol: string;       // normalized input symbol (as we requested)
  displaySymbol: string; // what to display (stripped of exchange prefix for crypto)
  c: number;   // current price
  d: number | null;  // change
  dp: number | null; // change %
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // unix seconds
  stale: boolean;
};

type CacheEntry = { at: number; data: Omit<FinnhubQuote, "symbol" | "displaySymbol" | "stale"> | null };

const CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 1000; // 60s cache to stay under 60 req/min with 25-symbol tape

function token(): string {
  const t = process.env.FINNHUB_API_KEY;
  if (!t) throw new Error("FINNHUB_API_KEY not set");
  return t;
}

function displayOf(symbol: string): string {
  // BINANCE:BTCUSDT → BTC
  const m = symbol.match(/^BINANCE:([A-Z]+)USDT$/);
  if (m) return m[1];
  return symbol;
}

async function fetchOne(symbol: string): Promise<CacheEntry["data"]> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if ("error" in j) return null;
    // Finnhub returns {c:0,d:null,dp:null,...} when symbol unknown
    const c = Number(j.c ?? 0);
    if (!c) return null;
    return {
      c,
      d: j.d == null ? null : Number(j.d),
      dp: j.dp == null ? null : Number(j.dp),
      h: Number(j.h ?? 0),
      l: Number(j.l ?? 0),
      o: Number(j.o ?? 0),
      pc: Number(j.pc ?? 0),
      t: Number(j.t ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Get quotes for many symbols in parallel, respecting cache.
 * Returns a map keyed by the input symbol. Failed symbols produce null.
 */
export async function getQuotes(
  symbols: string[],
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Record<string, FinnhubQuote | null>> {
  const now = Date.now();
  const toFetch: string[] = [];
  const result: Record<string, FinnhubQuote | null> = {};

  for (const sym of symbols) {
    const cached = CACHE.get(sym);
    if (cached && now - cached.at < ttlMs) {
      result[sym] = cached.data
        ? { symbol: sym, displaySymbol: displayOf(sym), stale: false, ...cached.data }
        : null;
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    const fetched = await Promise.all(toFetch.map(async (s) => [s, await fetchOne(s)] as const));
    for (const [sym, data] of fetched) {
      CACHE.set(sym, { at: now, data });
      result[sym] = data
        ? { symbol: sym, displaySymbol: displayOf(sym), stale: false, ...data }
        : null;
    }
  }

  return result;
}

export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  const map = await getQuotes([symbol]);
  return map[symbol];
}

// ====================================================================
// Earnings calendar / company news / basic financials
// (用于自动深度文章 pipeline)
// ====================================================================

export type FinnhubEarningRow = {
  symbol: string;
  date: string;                  // YYYY-MM-DD
  hour: string | null;           // 'bmo' / 'amc' / 'dmh' / null
  quarter: number;               // 1-4
  year: number;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
};

/**
 * 拉取一段时间的全市场财报日历。Free tier 不能按 symbol 过滤过去日期，
 * 但可以拿全市场一天 1500+ 条，本地按我们的 ticker 集合过滤即可。
 */
export async function fetchEarningsCalendar(
  fromISO: string,
  toISO: string,
): Promise<FinnhubEarningRow[]> {
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromISO}&to=${toISO}&token=${token()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`finnhub earnings ${res.status}`);
  const data = (await res.json()) as { earningsCalendar?: FinnhubEarningRow[] };
  return Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
}

export type FinnhubNewsItem = {
  category: string;
  datetime: number;             // unix seconds
  headline: string;
  id: number;
  image?: string;
  related?: string;
  source: string;
  summary: string;
  url: string;
};

export async function fetchCompanyNews(
  symbol: string,
  fromISO: string,
  toISO: string,
  limit = 8,
): Promise<FinnhubNewsItem[]> {
  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromISO}&to=${toISO}&token=${token()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as FinnhubNewsItem[];
    return Array.isArray(data) ? data.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export type FinnhubBasicFinancials = {
  metric?: Record<string, number | null>;
  metricType?: string;
};

export async function fetchBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
  const url = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FinnhubBasicFinancials;
  } catch {
    return null;
  }
}

