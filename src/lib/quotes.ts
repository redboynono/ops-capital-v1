/**
 * Unified quotes: US equities + US indices prefer Massive/Polygon when POLYGON_API_KEY is set;
 * HK, A-shares, crypto, forex use Yahoo (wider coverage, no key).
 */
import {
  getPolygonIndexSnapshots,
  getPolygonStockSnapshots,
  isPolygonIndexSymbol,
  isUsEquityTicker,
} from "@/lib/polygon";
import { getQuotes as getYahooQuotes, type YahooQuote } from "@/lib/yahoo";

export type Quote = YahooQuote;

export { isUsEquityTicker, isPolygonIndexSymbol };

type SnapshotQuote = {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
};

function snapshotToQuote(sym: string, p: SnapshotQuote, prev?: Quote | null): Quote {
  return {
    symbol: sym,
    displaySymbol: prev?.displaySymbol ?? sym,
    c: p.c,
    d: p.d,
    dp: p.dp,
    h: p.h,
    l: p.l,
    o: p.o,
    pc: p.pc,
    t: Math.floor(Date.now() / 1000),
    currency: prev?.currency ?? "USD",
    shortName: prev?.shortName ?? null,
    stale: false,
  };
}

export async function getQuotes(
  symbols: string[],
  ttlMs?: number,
): Promise<Record<string, Quote | null>> {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  if (!process.env.POLYGON_API_KEY) {
    return getYahooQuotes(unique, ttlMs);
  }

  const polygonIndices = unique.filter(isPolygonIndexSymbol);
  const polygonStocks = unique.filter(isUsEquityTicker);
  const polygonSet = new Set([...polygonIndices, ...polygonStocks]);
  const yahooSymbols = unique.filter((s) => !polygonSet.has(s));

  const [yahooQuotes, polyStocks, polyIndices] = await Promise.all([
    yahooSymbols.length > 0 ? getYahooQuotes(yahooSymbols, ttlMs) : Promise.resolve({} as Record<string, Quote | null>),
    polygonStocks.length > 0
      ? getPolygonStockSnapshots(polygonStocks).catch(() => ({} as Record<string, SnapshotQuote | null>))
      : Promise.resolve({} as Record<string, SnapshotQuote | null>),
    polygonIndices.length > 0
      ? getPolygonIndexSnapshots(polygonIndices).catch(() => ({} as Record<string, SnapshotQuote | null>))
      : Promise.resolve({} as Record<string, SnapshotQuote | null>),
  ]);

  const result: Record<string, Quote | null> = {};
  const yahooFallback: string[] = [];

  for (const sym of yahooSymbols) {
    result[sym] = yahooQuotes[sym] ?? null;
  }

  for (const sym of polygonStocks) {
    const p = polyStocks[sym];
    if (p) result[sym] = snapshotToQuote(sym, p);
    else yahooFallback.push(sym);
  }

  for (const sym of polygonIndices) {
    const p = polyIndices[sym];
    if (p) result[sym] = snapshotToQuote(sym, p);
    else yahooFallback.push(sym);
  }

  if (yahooFallback.length > 0) {
    const fb = await getYahooQuotes(yahooFallback, ttlMs);
    for (const sym of yahooFallback) {
      result[sym] = fb[sym] ?? null;
    }
  }

  return result;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const map = await getQuotes([symbol]);
  return map[symbol] ?? null;
}
