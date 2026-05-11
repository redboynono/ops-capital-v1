import {
  fetchBasicFinancials,
  fetchCompanyNews,
  fetchCompanyProfile,
  getQuote,
} from "@/lib/finnhub";
import { getRating, getFactorGrades } from "@/lib/ratings";

/**
 * 构建一只标的的实时 factsheet（profile + quote + 关键估值 + 评级 + 近 14 天 news）。
 * 给 Gemini Q&A / 自动文章 pipeline 共用：
 *   - 拉到的数据用于"锁住"实时数据（防止训练记忆 stale）
 *   - 任何 fetch 失败都安静降级（不抛异常，不阻塞其他 ticker）
 */
export async function buildTickerFactsheet(symbol: string): Promise<string> {
  const sym = symbol.toUpperCase();
  const today = new Date();
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - 14);
  const isoFrom = past.toISOString().slice(0, 10);
  const isoTo = today.toISOString().slice(0, 10);

  const safe = <T,>(p: Promise<T>) => p.catch(() => null) as Promise<T | null>;
  const [profile, quote, fin, news, rating, gradesMap] = await Promise.all([
    safe(fetchCompanyProfile(sym)),
    safe(getQuote(sym)),
    safe(fetchBasicFinancials(sym)),
    fetchCompanyNews(sym, isoFrom, isoTo, 6).catch(() => []),
    safe(getRating(sym)),
    safe(getFactorGrades(sym)),
  ]);

  const fmtNum = (v: unknown, d = 2) =>
    v == null || !Number.isFinite(Number(v)) ? "n/a" : Number(v).toFixed(d);
  const m: Record<string, number | null | undefined> = (fin?.metric ?? {}) as Record<string, number | null>;

  const lines: string[] = [];
  lines.push(`## ${sym} 公司概况`);
  if (profile?.name) lines.push(`- name: ${profile.name}`);
  if (profile?.finnhubIndustry) lines.push(`- industry: ${profile.finnhubIndustry}`);
  if (profile?.country) lines.push(`- country: ${profile.country}`);
  if (profile?.exchange) lines.push(`- exchange: ${profile.exchange}`);
  if (profile?.ipo) {
    const months = Math.round((today.getTime() - new Date(profile.ipo).getTime()) / (30 * 86400000));
    lines.push(`- ipo_date: ${profile.ipo} (距今约 ${months} 个月)`);
  }
  if (profile?.weburl) lines.push(`- weburl: ${profile.weburl}`);

  lines.push("");
  lines.push(`## 实时报价（Finnhub /quote, ${isoTo}）`);
  if (quote && Number.isFinite(quote.c)) {
    lines.push(`- current_price: $${fmtNum(quote.c)}`);
    lines.push(`- change_today: $${fmtNum(quote.d)} (${fmtNum(quote.dp)}%)`);
    lines.push(`- prev_close: $${fmtNum(quote.pc)}, day_high: $${fmtNum(quote.h)}, day_low: $${fmtNum(quote.l)}`);
  } else {
    lines.push("- (实时报价不可用)");
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
    const v = m[k];
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
      lines.push(`- Street verdict: ${rating.street_verdict} (score=${rating.street_score ?? "n/a"}, analysts=${rating.street_analyst_count ?? "?"})`);
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
    lines.push("- (近 14 天无 news 或获取失败)");
  }

  return lines.join("\n");
}
