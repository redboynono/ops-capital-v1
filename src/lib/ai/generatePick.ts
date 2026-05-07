import { callModel, extractJson } from "@/lib/ai/_runtime";
import { buildPickUserPrompt, picksSystemPrompt } from "@/lib/ai/picksPrompt";
import {
  fetchBasicFinancials,
  fetchCompanyNews,
  getQuote,
} from "@/lib/finnhub";
import { mysqlQuery } from "@/lib/mysql";
import {
  fetchYahooFundamentals,
  getQuote as getYahooQuote,
  isHkSymbol,
  toYahooSymbol,
  yahooToFinnhubMetric,
} from "@/lib/yahoo";

export type PickDraft = {
  title: string;
  subtitle: string | null;
  thesis_md: string;
  catalysts_md: string | null;
  risks_md: string | null;
  valuation_md: string | null;
  sell_discipline_md: string | null;
  entry_price: number;
  target_price: number | null;
  stop_price: number | null;
  horizon_months: number;
  conviction: "high" | "medium" | "low";
  tags: string | null;
  // Echo-back for the editor UI:
  ticker_symbol: string;
  ticker_name: string;
  source_summary: string;   // brief "what data we used" line for the toast
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNum(v: unknown): number | null {
  const x = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) ? x : null;
}
function asConviction(v: unknown): "high" | "medium" | "low" {
  const s = String(v ?? "").toLowerCase();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

/**
 * Generate an editor-ready Pick draft for `symbol`.
 *
 * Pulls the same factsheet inputs as ratings (Finnhub for US, Yahoo for HK),
 * plus the latest ticker_ratings row + factor_grades, then asks the model
 * to produce a complete Pick with target/stop/horizon/markdown sections.
 *
 * Does NOT write to DB — the admin reviews & saves through the existing
 * upsert flow.
 */
export async function generatePickDraft(
  symbol: string,
  ticker: { name: string; sector: string | null },
): Promise<PickDraft> {
  // ---- 1. Factsheet ----
  const newsFrom = new Date();
  newsFrom.setUTCDate(newsFrom.getUTCDate() - 30);
  const newsTo = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  let quote: Awaited<ReturnType<typeof getQuote>> | null = null;
  let metrics: Record<string, unknown> | null = null;
  let news: Awaited<ReturnType<typeof fetchCompanyNews>> = [];

  if (isHkSymbol(symbol)) {
    const ySym = toYahooSymbol(symbol);
    const [yQuote, yFund] = await Promise.all([
      getYahooQuote(ySym).catch(() => null),
      fetchYahooFundamentals(ySym).catch(() => null),
    ]);
    if (yQuote) {
      quote = {
        symbol,
        displaySymbol: yQuote.displaySymbol,
        c: yQuote.c,
        d: yQuote.d,
        dp: yQuote.dp,
        h: yQuote.h,
        l: yQuote.l,
        o: yQuote.o,
        pc: yQuote.pc,
        t: yQuote.t,
        stale: yQuote.stale,
      };
    }
    if (yFund) metrics = yahooToFinnhubMetric(yFund);
  } else {
    const [fhQuote, fin, fhNews] = await Promise.all([
      getQuote(symbol).catch(() => null),
      fetchBasicFinancials(symbol).catch(() => null),
      fetchCompanyNews(symbol, isoDate(newsFrom), isoDate(newsTo), 8).catch(() => []),
    ]);
    quote = fhQuote;
    metrics = fin?.metric ?? null;
    news = fhNews;
  }

  // ---- 2. Latest rating + factor grades ----
  const ratingRows = await mysqlQuery<Array<{
    ops_verdict: string | null;
    ops_score: string | number | null;
    ops_target_price: string | number | null;
    quant_score: string | number | null;
    street_target_price: string | number | null;
    rank_overall: number | null;
    rank_overall_total: number | null;
    industry: string | null;
    has_dividend: number;
    last_refreshed_at: string | null;
  }>>(
    `select ops_verdict, ops_score, ops_target_price, quant_score,
            street_target_price, rank_overall, rank_overall_total,
            industry, has_dividend, last_refreshed_at
       from ticker_ratings where symbol = ? limit 1`,
    [symbol],
  );
  const r0 = ratingRows[0];
  const latestRating = r0
    ? {
        ops_verdict: r0.ops_verdict,
        ops_score: asNum(r0.ops_score),
        ops_target_price: asNum(r0.ops_target_price),
        quant_score: asNum(r0.quant_score),
        street_target_price: asNum(r0.street_target_price),
        rank_overall: r0.rank_overall,
        rank_overall_total: r0.rank_overall_total,
        industry: r0.industry,
        has_dividend: !!r0.has_dividend,
        last_refreshed_at: r0.last_refreshed_at,
      }
    : null;

  const factorGrades = await mysqlQuery<Array<{ factor: string; grade_now: string | null }>>(
    "select factor, grade_now from ticker_factor_grades where symbol = ? and grade_now is not null order by factor",
    [symbol],
  );

  // ---- 3. Build prompt + call model ----
  const userPrompt = buildPickUserPrompt({
    symbol,
    name: ticker.name,
    sector: ticker.sector,
    quote: quote
      ? { c: quote.c, d: quote.d, dp: quote.dp, h: quote.h, l: quote.l, o: quote.o, pc: quote.pc }
      : null,
    metrics,
    news: news as Array<{ datetime: number; headline: string; source: string; summary?: string }>,
    latestRating,
    factorGrades,
  });

  const raw = await callModel(picksSystemPrompt, userPrompt, { temperature: 0.4, maxTokens: 6000 });
  const parsed = extractJson(raw);

  // ---- 4. Coerce + return ----
  const entry = asNum(parsed.entry_price) ?? quote?.c ?? 0;
  const target = asNum(parsed.target_price);
  const stop = asNum(parsed.stop_price);
  const horizonRaw = asNum(parsed.horizon_months);
  const horizon = horizonRaw && horizonRaw >= 1 && horizonRaw <= 36 ? Math.round(horizonRaw) : 12;

  const sourceSummary = [
    quote ? `quote $${quote.c.toFixed(2)}` : "no quote",
    metrics ? "metrics" : "no metrics",
    `news ${news.length}`,
    latestRating ? `OPS=${latestRating.ops_verdict ?? "?"}` : "no rating",
    factorGrades.length ? `${factorGrades.length} factors` : "no factors",
  ].join(" · ");

  return {
    title: asString(parsed.title) || `${symbol} · OPS Pick`,
    subtitle: asString(parsed.subtitle) || null,
    thesis_md: asString(parsed.thesis_md),
    catalysts_md: asString(parsed.catalysts_md) || null,
    risks_md: asString(parsed.risks_md) || null,
    valuation_md: asString(parsed.valuation_md) || null,
    sell_discipline_md: asString(parsed.sell_discipline_md) || null,
    entry_price: Number.isFinite(entry) && entry > 0 ? Number(entry.toFixed(2)) : 0,
    target_price: target,
    stop_price: stop,
    horizon_months: horizon,
    conviction: asConviction(parsed.conviction),
    tags: asString(parsed.tags) || null,
    ticker_symbol: symbol,
    ticker_name: ticker.name,
    source_summary: sourceSummary,
  };
}
