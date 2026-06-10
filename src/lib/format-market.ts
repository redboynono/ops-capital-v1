export function fmtMoney(n: number | null | undefined, currency = "USD"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sym = currency === "USD" ? "$" : currency === "HKD" ? "HK$" : "";
  if (Math.abs(n) >= 1000) {
    return `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return `${sym}${n.toFixed(2)}`;
}

/** Finnhub profile marketCap / metric marketCapitalization are in millions USD. */
export function fmtMarketCap(millions: number | null | undefined): string {
  if (millions == null || !Number.isFinite(millions) || millions <= 0) return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(0)}M`;
}

export function fmtRatio(n: number | null | undefined, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}${suffix}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
