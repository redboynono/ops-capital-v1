/**
 * Unified quotes: US equities prefer Massive/Polygon when POLYGON_API_KEY is set;
 * indices, HK, A-shares, crypto, forex still use Yahoo (no key, wider coverage).
 */
import { getPolygonStockSnapshots, isUsEquityTicker } from "@/lib/polygon";
import { getQuotes as getYahooQuotes, getQuote as getYahooQuote, type YahooQuote } from "@/lib/yahoo";

export type Quote = YahooQuote;

export { isUsEquityTicker };

export async function getQuotes(
  symbols: string[],
  ttlMs?: number,
): Promise<Record<string, Quote | null>> {
  const yahoo = await getYahooQuotes(symbols, ttlMs);
  if (!process.env.POLYGON_API_KEY) return yahoo;

  const us = symbols.filter(isUsEquityTicker);
  if (us.length === 0) return yahoo;

  try {
    const poly = await getPolygonStockSnapshots(us);
    for (const sym of us) {
      const p = poly[sym];
      if (!p) continue;
      const prev = yahoo[sym];
      yahoo[sym] = {
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
  } catch {
    // keep Yahoo fallback on Polygon errors
  }

  return yahoo;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const map = await getQuotes([symbol]);
  return map[symbol];
}
