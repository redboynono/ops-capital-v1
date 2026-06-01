import { searchSymbols, type FinnhubSearchHit } from "@/lib/finnhub";
import { canonicalHkYahooSymbol, normalizeInternalSymbol } from "@/lib/symbol-resolve";

export type MarketSearchHit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: string;
  exchange?: string;
  source: "finnhub" | "yahoo";
};

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  score?: number;
};

const PREFERRED_EXCHANGES = new Set([
  "NMS",
  "NGM",
  "NYQ",
  "NYQ",
  "NASDAQ",
  "NYSE",
  "HKG",
  "HKEX",
  "SHH",
  "SHZ",
  "SSE",
  "SZSE",
]);

function hitKey(symbol: string): string {
  return normalizeInternalSymbol(symbol);
}

function rankHit(h: MarketSearchHit): number {
  let score = 0;
  if (h.type === "Common Stock" || h.type === "EQUITY") score -= 20;
  if (h.type === "ADR") score -= 10;
  if (h.type === "ETP" || h.type === "ETF") score -= 5;
  if (h.exchange && PREFERRED_EXCHANGES.has(h.exchange)) score -= 8;
  if (h.symbol.endsWith(".HK") || /^\d{4,5}$/.test(h.symbol)) score -= 6;
  if (h.type === "CRYPTOCURRENCY") score += 50;
  return score;
}

async function searchYahooSymbols(q: string, limit: number): Promise<MarketSearchHit[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=${limit}&newsCount=0`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { quotes?: YahooQuote[] };
    const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
    const out: MarketSearchHit[] = [];
    for (const quote of quotes) {
      const rawSymbol = quote.symbol?.trim();
      if (!rawSymbol) continue;
      if (quote.quoteType === "CRYPTOCURRENCY" && !/crypto|btc|eth|usd/i.test(q)) continue;
      const yahooSym =
        quote.exchange === "HKG" || /\.HK$/i.test(rawSymbol)
          ? canonicalHkYahooSymbol(rawSymbol)
          : rawSymbol.toUpperCase();
      const name = (quote.longname || quote.shortname || yahooSym).trim();
      out.push({
        symbol: normalizeInternalSymbol(yahooSym),
        displaySymbol: yahooSym,
        name,
        type: quote.quoteType ?? "EQUITY",
        exchange: quote.exchange,
        source: "yahoo",
      });
    }
    return out;
  } catch {
    return [];
  }
}

function finnhubToHit(h: FinnhubSearchHit): MarketSearchHit {
  return {
    symbol: normalizeInternalSymbol(h.symbol),
    displaySymbol: h.displaySymbol || h.symbol,
    name: h.description,
    type: h.type,
    source: "finnhub",
  };
}

/**
 * 全市场符号搜索：Finnhub + Yahoo（补足港股/名称如 MiniMax → 0100.HK）。
 */
export async function searchMarketSymbols(q: string, limit = 8): Promise<MarketSearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 1) return [];

  const [finnhub, yahoo] = await Promise.all([
    searchSymbols(trimmed, limit).catch(() => [] as FinnhubSearchHit[]),
    searchYahooSymbols(trimmed, limit),
  ]);

  const merged = new Map<string, MarketSearchHit>();
  for (const h of finnhub.map(finnhubToHit)) {
    merged.set(hitKey(h.symbol), h);
  }
  for (const h of yahoo) {
    const key = hitKey(h.symbol);
    if (!merged.has(key)) merged.set(key, h);
  }

  return [...merged.values()]
    .sort((a, b) => rankHit(a) - rankHit(b) || a.symbol.length - b.symbol.length)
    .slice(0, limit);
}
