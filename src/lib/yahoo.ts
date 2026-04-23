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
