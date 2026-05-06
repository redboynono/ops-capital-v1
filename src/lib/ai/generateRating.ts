import {
  buildRatingsUserPromptWithFactsheet,
  ratingsSystemPrompt,
} from "@/lib/ai/ratingsPrompt";
import {
  fetchBasicFinancials,
  fetchCompanyNews,
  getQuote,
} from "@/lib/finnhub";
import {
  fetchYahooFundamentals,
  getQuote as getYahooQuote,
  isHkSymbol,
  toYahooSymbol,
  yahooToFinnhubMetric,
} from "@/lib/yahoo";
import {
  CORE_FACTORS,
  DIVIDEND_FACTORS,
  type FactorKey,
  type Grade,
  type Verdict,
  recomputeAndStoreQuantScore,
  upsertFactorGrade,
  upsertRating,
} from "@/lib/ratings";
import {
  appendFactorGradeSnapshots,
  appendRatingSnapshot,
  resolveHistoricalGrades,
} from "@/lib/ratingsSnapshot";
import { mysqlQuery } from "@/lib/mysql";

const VALID_VERDICTS = new Set<Verdict>(["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"]);
const VALID_GRADES = new Set<Grade>([
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
]);

function safeVerdict(v: unknown): Verdict | null {
  if (typeof v !== "string") return null;
  return VALID_VERDICTS.has(v as Verdict) ? (v as Verdict) : null;
}
function safeGrade(g: unknown): Grade | null {
  if (typeof g !== "string") return null;
  const up = g.toUpperCase().replace("＋", "+").replace("－", "-");
  return VALID_GRADES.has(up as Grade) ? (up as Grade) : null;
}
function safeNum(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

async function callModel(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set on server");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";

  const res = await fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`Upstream err ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty model output");
  return content;
}

export type GenerateRatingResult = {
  symbol: string;
  quant_score: number | null;
  factors_now: Partial<Record<FactorKey, Grade>>;
  history_hit_3m: number;
  history_hit_6m: number;
};

/**
 * End-to-end AI rating generation with factsheet grounding + history snapshot.
 *
 * Flow:
 *   1) pull Finnhub quote + basicFinancials + news
 *   2) build factsheet-grounded prompt
 *   3) call AI, extract JSON
 *   4) write ticker_ratings + factor_grades (grade_now only)
 *   5) lookup ticker_factor_grades_history for 3M/6M → write grade_3m/grade_6m
 *   6) append snapshot rows to history tables
 *   7) recompute quant_score from factor weights
 */
export async function generateAndSaveRating(
  symbol: string,
  ticker: { name: string; sector: string | null },
  source: "AI" | "CRON" | "MANUAL" = "AI",
): Promise<GenerateRatingResult> {
  // ---- 1. pull factsheet data in parallel ----
  // HK tickers (5-digit codes) are not on Finnhub free tier; fall back to Yahoo.
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
    // Finnhub /company-news doesn't cover HK on free tier → leave news empty
  } else {
    const [fhQuote, fin, fhNews] = await Promise.all([
      getQuote(symbol).catch(() => null),
      fetchBasicFinancials(symbol).catch(() => null),
      fetchCompanyNews(symbol, isoDate(newsFrom), isoDate(newsTo), 6).catch(() => []),
    ]);
    quote = fhQuote;
    metrics = fin?.metric ?? null;
    news = fhNews;
  }

  // ---- 2. build grounded prompt ----
  const userPrompt = buildRatingsUserPromptWithFactsheet({
    symbol,
    name: ticker.name,
    sector: ticker.sector,
    quote,
    metrics,
    news,
  });

  // ---- 3. call AI ----
  const raw = await callModel(ratingsSystemPrompt, userPrompt);
  const parsed = extractJson(raw);

  // ---- 4. extract factor "now" grades ----
  const factorsRaw = (parsed.factors ?? {}) as Record<string, { now?: unknown } | null>;
  const factorsNow: Partial<Record<FactorKey, Grade>> = {};
  for (const key of [...CORE_FACTORS, ...DIVIDEND_FACTORS]) {
    const v = factorsRaw[key];
    if (!v) continue;
    const g = safeGrade(v.now);
    if (g) factorsNow[key] = g;
  }

  // ---- 5. write top-level rating ----
  const ratingData = {
    ops_verdict: safeVerdict(parsed.ops_verdict),
    ops_score: safeNum(parsed.ops_score),
    ops_target_price: safeNum(parsed.ops_target_price),
    street_verdict: safeVerdict(parsed.street_verdict),
    street_score: safeNum(parsed.street_score),
    street_target_price: safeNum(parsed.street_target_price),
    street_analyst_count: safeNum(parsed.street_analyst_count),
    rank_overall: safeNum(parsed.rank_overall),
    rank_overall_total: safeNum(parsed.rank_overall_total),
    rank_sector: safeNum(parsed.rank_sector),
    rank_sector_total: safeNum(parsed.rank_sector_total),
    rank_industry: safeNum(parsed.rank_industry),
    rank_industry_total: safeNum(parsed.rank_industry_total),
    industry: typeof parsed.industry === "string" ? parsed.industry : ticker.sector,
    has_dividend: !!parsed.has_dividend,
    notes: typeof parsed.notes === "string" ? parsed.notes : null,
    // ticker_ratings.source is a narrower enum without "CRON"; map CRON → AI there
    source: (source === "CRON" ? "AI" : source) as "AI" | "MANUAL",
  };
  await upsertRating(symbol, ratingData);

  // ---- 6. lookup 3M / 6M from history ----
  const allFactors = [...CORE_FACTORS, ...DIVIDEND_FACTORS];
  const history = await resolveHistoricalGrades(symbol, allFactors);
  let hit3 = 0;
  let hit6 = 0;
  for (const f of allFactors) {
    const now = factorsNow[f] ?? null;
    const { m3, m6 } = history[f] ?? { m3: null, m6: null };
    if (m3) hit3++;
    if (m6) hit6++;
    // write all three columns (now from AI, m3/m6 from history; null if no history)
    await upsertFactorGrade(symbol, f, { now, m3, m6 });
  }

  // ---- 7. recompute quant_score ----
  const quant = await recomputeAndStoreQuantScore(symbol);

  // ---- 8. append snapshots to history ----
  await Promise.all([
    appendFactorGradeSnapshots(symbol, factorsNow),
    appendRatingSnapshot(symbol, {
      ops_verdict: ratingData.ops_verdict,
      ops_score: ratingData.ops_score,
      ops_target_price: ratingData.ops_target_price,
      street_verdict: ratingData.street_verdict,
      street_score: ratingData.street_score,
      street_target_price: ratingData.street_target_price,
      quant_score: quant,
      rank_overall: ratingData.rank_overall,
      rank_sector: ratingData.rank_sector,
      rank_industry: ratingData.rank_industry,
      industry: ratingData.industry,
      notes: ratingData.notes,
      source,
    }),
    mysqlQuery(
      "update ticker_ratings set last_refreshed_at = now(3) where symbol = ?",
      [symbol],
    ),
  ]);

  return {
    symbol,
    quant_score: quant,
    factors_now: factorsNow,
    history_hit_3m: hit3,
    history_hit_6m: hit6,
  };
}
