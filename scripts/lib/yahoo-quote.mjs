/** 与 src/lib/symbol-resolve + yahoo.ts 对齐的轻量 Yahoo 行情（供 cron 脚本用） */

const CRYPTO_SHORTS = new Set(["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"]);

export function isCryptoSymbol(sym) {
  return CRYPTO_SHORTS.has(String(sym).toUpperCase());
}

export function toYahooSymbol(sym) {
  const s = String(sym).toUpperCase();
  const cryptoUsd = s.match(/^([A-Z]{2,10})-USD$/);
  if (cryptoUsd) return `${cryptoUsd[1]}-USD`;
  if (/^\d{4,5}$/.test(s)) {
    const n = String(parseInt(s, 10)).padStart(4, "0");
    return `${n}.HK`;
  }
  const hk = s.match(/^(\d{1,5})\.HK$/);
  if (hk) return `${String(parseInt(hk[1], 10)).padStart(4, "0")}.HK`;
  if (CRYPTO_SHORTS.has(s)) return `${s}-USD`;
  return s;
}

export async function fetchYahooQuote(sym) {
  const yahoo = toYahooSymbol(sym);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const meta = j?.chart?.result?.[0]?.meta;
    const c = Number(meta?.regularMarketPrice ?? 0);
    const pc = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? 0);
    const h = Number(meta?.regularMarketDayHigh ?? 0);
    const l = Number(meta?.regularMarketDayLow ?? 0);
    const o = Number(meta?.regularMarketOpen ?? 0);
    if (!c) return null;
    const d = pc ? c - pc : null;
    const dp = pc ? ((c - pc) / pc) * 100 : null;
    return {
      c,
      d,
      dp,
      h: h || null,
      l: l || null,
      o: o || null,
      pc,
      currency: meta?.currency ?? (isCryptoSymbol(sym) ? "USD" : null),
      shortName: meta?.shortName ?? null,
      yahooSymbol: yahoo,
    };
  } catch {
    return null;
  }
}
