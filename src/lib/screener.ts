import { mysqlQuery } from "@/lib/mysql";
import {
  CORE_FACTORS,
  type FactorKey,
  type Grade,
  type Verdict,
  gradeToGpa,
} from "@/lib/ratings";

export type ScreenerRow = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  ops_verdict: Verdict | null;
  ops_score: number | null; // 1.00 – 5.00
  quant_score: number | null;
  has_dividend: number; // 0/1
  rank_overall: number | null;
  rank_overall_total: number | null;
  rating_updated_at: string | null;
  grades: Partial<Record<FactorKey, Grade | null>>;
};

type TickerCore = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
};

type RatingCore = {
  symbol: string;
  industry: string | null;
  ops_verdict: Verdict | null;
  ops_score: string | null;
  quant_score: string | null;
  has_dividend: number;
  rank_overall: number | null;
  rank_overall_total: number | null;
  updated_at: string;
};

type FactorCore = {
  symbol: string;
  factor: FactorKey;
  grade_now: Grade | null;
};

/**
 * 一次性拉全市场标的 + 评级 + 因子等级，给 Screener 客户端做过滤排序。
 * 30~ 量级标的，整体载入是合理的；将来扩到 200+ 时再迁到分页 API。
 */
export async function listScreenerRows(): Promise<ScreenerRow[]> {
  const [tickers, ratings, factors] = await Promise.all([
    mysqlQuery<TickerCore[]>(
      "select symbol, name, exchange, sector from tickers order by symbol",
    ),
    mysqlQuery<RatingCore[]>(
      `select symbol, industry, ops_verdict, ops_score, quant_score,
              has_dividend, rank_overall, rank_overall_total, updated_at
         from ticker_ratings`,
    ),
    mysqlQuery<FactorCore[]>(
      `select symbol, factor, grade_now
         from ticker_factor_grades
         where factor in ('VALUATION','GROWTH','PROFITABILITY','MOMENTUM','REVISIONS')`,
    ),
  ]);

  const ratingMap = new Map<string, RatingCore>();
  for (const r of ratings) ratingMap.set(r.symbol, r);

  const gradesMap = new Map<string, Partial<Record<FactorKey, Grade | null>>>();
  for (const f of factors) {
    if (!CORE_FACTORS.includes(f.factor as (typeof CORE_FACTORS)[number])) continue;
    const m = gradesMap.get(f.symbol) ?? {};
    m[f.factor] = f.grade_now ?? null;
    gradesMap.set(f.symbol, m);
  }

  const rows: ScreenerRow[] = tickers.map((t) => {
    const r = ratingMap.get(t.symbol);
    const num = (s: string | null | undefined) =>
      s == null ? null : Number.isFinite(Number(s)) ? Number(s) : null;
    return {
      symbol: t.symbol,
      name: t.name,
      exchange: t.exchange,
      sector: t.sector,
      industry: r?.industry ?? null,
      ops_verdict: r?.ops_verdict ?? null,
      ops_score: num(r?.ops_score ?? null),
      quant_score: num(r?.quant_score ?? null),
      has_dividend: r?.has_dividend ?? 0,
      rank_overall: r?.rank_overall ?? null,
      rank_overall_total: r?.rank_overall_total ?? null,
      rating_updated_at: r?.updated_at ?? null,
      grades: gradesMap.get(t.symbol) ?? {},
    };
  });

  return rows;
}

/** 把字母评级转成单调 GPA，便于做 “≥ B” 这类比较；空评级返回 null。 */
export function gradePassesMin(grade: Grade | null | undefined, minGpa: number) {
  const g = gradeToGpa(grade ?? null);
  if (g == null) return false;
  return g >= minGpa;
}
