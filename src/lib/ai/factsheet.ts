import {
  fetchBasicFinancials,
  fetchCompanyNews,
  fetchCompanyProfile,
  getQuote,
  type FinnhubCompanyProfile,
} from "@/lib/finnhub";
import { getRating, getFactorGrades } from "@/lib/ratings";
import { isCryptoSymbol, normalizeInternalSymbol } from "@/lib/symbol-resolve";
import { getTickerBySymbol } from "@/lib/tickers";
import {
  fetchYahooFundamentals,
  getQuote as getYahooQuote,
  isHkSymbol,
  toYahooSymbol,
  yahooToFinnhubMetric,
} from "@/lib/yahoo";

/**
 * 构建一只标的的实时 factsheet（profile + quote + 关键估值 + 评级 + 近 14 天 news）。
 * 美股走 Finnhub；港股 / 加密（BTC→BTC-USD）走 Yahoo，避免错误报价。
 */
export async function buildTickerFactsheet(symbol: string): Promise<string> {
  const sym = normalizeInternalSymbol(symbol);
  const today = new Date();
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - 14);
  const isoFrom = past.toISOString().slice(0, 10);
  const isoTo = today.toISOString().slice(0, 10);

  const safe = <T,>(p: Promise<T>) => p.catch(() => null) as Promise<T | null>;

  let profile: FinnhubCompanyProfile | null = null;
  let quote: {
    c: number;
    d?: number | null;
    dp?: number | null;
    h?: number;
    l?: number;
    pc?: number;
  } | null = null;
  let metrics: Record<string, number | null | undefined> = {};
  let news: Awaited<ReturnType<typeof fetchCompanyNews>> = [];
  let currency = "USD";
  let displayName: string | null = null;
  let quoteSource = "Finnhub";

  if (isHkSymbol(sym) || isCryptoSymbol(sym)) {
    const ySym = toYahooSymbol(sym);
    const [yQuote, yFund] = await Promise.all([
      safe(getYahooQuote(ySym)),
      isCryptoSymbol(sym) ? Promise.resolve(null) : safe(fetchYahooFundamentals(ySym)),
    ]);
    quoteSource = `Yahoo (${ySym})`;
    currency = yQuote?.currency ?? (isCryptoSymbol(sym) ? "USD" : "HKD");
    displayName = yQuote?.shortName ?? null;
    if (yQuote?.c) {
      quote = {
        c: yQuote.c,
        d: yQuote.d ?? 0,
        dp: yQuote.dp ?? 0,
        h: yQuote.h,
        l: yQuote.l,
        pc: yQuote.pc,
      };
    }
    if (yFund) metrics = yahooToFinnhubMetric(yFund);
  } else {
    const [p, q, fin, n] = await Promise.all([
      safe(fetchCompanyProfile(sym)),
      safe(getQuote(sym)),
      safe(fetchBasicFinancials(sym)),
      fetchCompanyNews(sym, isoFrom, isoTo, 6).catch(() => []),
    ]);
    profile = p;
    quote = q;
    metrics = (fin?.metric ?? {}) as Record<string, number | null | undefined>;
    news = n;
    currency = profile?.currency ?? "USD";
    displayName = profile?.name ?? null;
  }

  const dbTicker = await getTickerBySymbol(sym).catch(() => null);
  if (!displayName) displayName = dbTicker?.name ?? null;

  const fmtNum = (v: unknown, d = 2) =>
    v == null || !Number.isFinite(Number(v)) ? "n/a" : Number(v).toFixed(d);
  const money = (v: unknown) => {
    const n = fmtNum(v);
    if (n === "n/a") return n;
    const prefix = currency === "HKD" ? "HK$" : currency === "USD" ? "$" : `${currency} `;
    return `${prefix}${n}`;
  };

  const [rating, gradesMap] = await Promise.all([
    safe(getRating(sym)),
    safe(getFactorGrades(sym)),
  ]);

  const lines: string[] = [];
  lines.push(`## ${sym}${displayName ? ` · ${displayName}` : ""} 公司概况`);
  if (displayName) lines.push(`- name: ${displayName}`);
  if (profile?.finnhubIndustry) lines.push(`- industry: ${profile.finnhubIndustry}`);
  if (profile?.country) lines.push(`- country: ${profile.country}`);
  if (isHkSymbol(sym)) lines.push(`- exchange: HKEX`);
  else if (profile?.exchange) lines.push(`- exchange: ${profile.exchange}`);
  if (profile?.ipo) {
    const months = Math.round((today.getTime() - new Date(profile.ipo).getTime()) / (30 * 86400000));
    lines.push(`- ipo_date: ${profile.ipo} (距今约 ${months} 个月)`);
  }
  if (profile?.weburl) lines.push(`- weburl: ${profile.weburl}`);
  if (isHkSymbol(sym)) lines.push(`- yahoo_symbol: ${toYahooSymbol(sym)}`);

  lines.push("");
  lines.push(`## 实时报价（${quoteSource}, ${isoTo}）`);
  if (quote && Number.isFinite(quote.c) && quote.c > 0) {
    lines.push(`- current_price: ${money(quote.c)}`);
    lines.push(`- change_today: ${money(quote.d)} (${fmtNum(quote.dp)}%)`);
    lines.push(
      `- prev_close: ${money(quote.pc)}, day_high: ${money(quote.h)}, day_low: ${money(quote.l)}`,
    );
  } else {
    lines.push("- (实时报价不可用 — 请勿编造 $0 价格，应说明数据缺失)");
  }

  const metricKeys: [string, string][] = [
    ["52WeekHigh", "52W 高"],
    ["52WeekLow", "52W 低"],
    ["peTTM", "PE TTM"],
    ["psTTM", "PS TTM"],
    ["pbAnnual", "PB"],
    ["epsTTM", "EPS TTM"],
    ["grossMarginTTM", "毛利率% TTM"],
    ["netProfitMarginTTM", "净利率% TTM"],
    ["roeTTM", "ROE% TTM"],
    ["beta", "Beta"],
    ["dividendYieldIndicatedAnnual", "股息率%"],
    ["marketCapitalization", "市值 (M USD)"],
    ["revenueGrowth5Y", "营收 5Y CAGR%"],
    ["epsGrowth5Y", "EPS 5Y CAGR%"],
  ];
  const metricLines: string[] = [];
  for (const [k, label] of metricKeys) {
    const v = metrics[k];
    if (v == null || !Number.isFinite(Number(v))) continue;
    metricLines.push(`${label}=${fmtNum(v)}`);
  }
  if (metricLines.length > 0) {
    lines.push("");
    lines.push(`## 关键估值/财务：${metricLines.join(" / ")}`);
  }

  if (rating) {
    lines.push("");
    lines.push("## OPS 评级");
    if (rating.ops_verdict) lines.push(`- OPS verdict: ${rating.ops_verdict} (score=${rating.ops_score ?? "n/a"})`);
    if (rating.street_verdict)
      lines.push(
        `- Street verdict: ${rating.street_verdict} (score=${rating.street_score ?? "n/a"}, analysts=${rating.street_analyst_count ?? "?"})`,
      );
    if (rating.quant_score) lines.push(`- OPS Quant score: ${rating.quant_score}`);
    if (rating.ops_target_price) lines.push(`- OPS target_price: ${rating.ops_target_price}`);
    if (rating.street_target_price) lines.push(`- Street target_price: ${rating.street_target_price}`);
  }

  if (gradesMap && gradesMap.size > 0) {
    const parts: string[] = [];
    for (const [factor, row] of gradesMap.entries()) {
      if (row?.grade_now) parts.push(`${factor}=${row.grade_now}`);
    }
    if (parts.length > 0) {
      lines.push("");
      lines.push(`## 因子等级：${parts.join(" / ")}`);
    }
  }

  lines.push("");
  lines.push(`## 近 14 天 news headlines（${isoFrom} → ${isoTo}）`);
  if (news.length > 0) {
    for (const n of news) {
      const date = new Date(n.datetime * 1000).toISOString().slice(0, 10);
      lines.push(`- [${date}] ${n.headline}（${n.source ?? "?"}）`);
      if (n.summary) lines.push(`  ${String(n.summary).slice(0, 160)}`);
    }
  } else {
    lines.push(
      isHkSymbol(sym) || isCryptoSymbol(sym)
        ? "- (港股/加密 Finnhub news 不可用)"
        : "- (近 14 天无 news 或获取失败)",
    );
  }

  return lines.join("\n");
}
