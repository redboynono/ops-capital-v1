/**
 * 统一标的代码：库内港股为 5 位（00700），Yahoo 为 0700.HK / 0100.HK，Finnhub 多为纯字母美股。
 */

export function normalizeInternalSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  const hkSuffix = s.match(/^(\d{1,5})\.HK$/);
  if (hkSuffix) return hkSuffix[1].padStart(5, "0");
  if (/^\d{4,5}$/.test(s)) return s.padStart(5, "0");
  return s;
}

/** Yahoo 行情用 4 位港股代码，避免 100.HK 误指 ETF 而非 MiniMax 的 0100.HK */
export function canonicalHkYahooSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  const m = s.match(/^(\d{1,5})\.HK$/);
  if (!m) return s;
  return `${String(parseInt(m[1], 10)).padStart(4, "0")}.HK`;
}

/** 用于 DB / watchlist 查询的候选 key（去重保序） */
export function symbolLookupCandidates(raw: string): string[] {
  const s = raw.trim().toUpperCase();
  const internal = normalizeInternalSymbol(s);
  const out: string[] = [];
  for (const c of [s, internal]) {
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

export function isHkStyleSymbol(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  return /^\d{4,5}$/.test(s) || /^\d{1,5}\.HK$/i.test(s);
}
