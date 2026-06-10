/**
 * 价格历史（用于 sparkline）。
 *
 * 优先 Yahoo Finance v8 chart API（免费、无 key、无 rate-limit 风险阈值低）。
 * Finnhub /stock/candle 已转付费，不再走它。
 *
 * 缓存 1 小时：sparkline 不需要分钟级新鲜度。
 */

export type PriceHistoryRange = "1mo" | "3mo" | "6mo" | "1y" | "5y";

export type PricePoint = { t: number; c: number };
export type PriceHistory = {
  symbol: string;
  range: PriceHistoryRange;
  points: PricePoint[];
};

const CACHE = new Map<string, { at: number; data: PriceHistory | null }>();
const TTL_MS = 60 * 60 * 1000; // 1h

function intervalFor(range: PriceHistoryRange): string {
  switch (range) {
    case "1mo":
      return "1d";
    case "3mo":
    case "6mo":
      return "1d";
    case "1y":
      return "1wk";
    case "5y":
      return "1mo";
  }
}

async function fetchYahoo(symbol: string, range: PriceHistoryRange): Promise<PriceHistory | null> {
  const interval = intervalFor(range);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        // Yahoo 偶尔会拒绝默认 UA，给一个浏览器味的串
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
        error?: unknown;
      };
    };
    const r = j?.chart?.result?.[0];
    if (!r || j?.chart?.error) return null;
    const ts = r.timestamp ?? [];
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const points: PricePoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c)) continue;
      points.push({ t: ts[i], c });
    }
    if (points.length < 2) return null;
    return { symbol, range, points };
  } catch {
    return null;
  }
}

export async function getPriceHistory(
  symbol: string,
  range: PriceHistoryRange = "1y",
): Promise<PriceHistory | null> {
  const key = `${symbol.toUpperCase()}::${range}`;
  const now = Date.now();
  const cached = CACHE.get(key);
  if (cached && now - cached.at < TTL_MS) return cached.data;

  const data = await fetchYahoo(symbol, range);
  CACHE.set(key, { at: now, data });
  return data;
}

export async function getPriceHistories(
  symbols: string[],
  range: PriceHistoryRange = "1y",
): Promise<Record<string, PriceHistory | null>> {
  const out: Record<string, PriceHistory | null> = {};
  const results = await Promise.all(symbols.map((s) => getPriceHistory(s, range)));
  symbols.forEach((s, i) => {
    out[s.toUpperCase()] = results[i];
  });
  return out;
}
