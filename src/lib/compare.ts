import {
  fetchBasicFinancials,
  fetchCompanyNews,
  fetchCompanyProfile,
  getQuote,
  type FinnhubBasicFinancials,
  type FinnhubCompanyProfile,
  type FinnhubNewsItem,
  type FinnhubQuote,
} from "@/lib/finnhub";
import { getRating, getFactorGrades, type FactorKey, type Grade, type Verdict } from "@/lib/ratings";
import { getTickerBySymbol, type TickerRow } from "@/lib/tickers";

export const COMPARE_MAX = 4;

export type CompareColumn = {
  symbol: string;
  ticker: TickerRow | null;
  profile: FinnhubCompanyProfile | null;
  quote: FinnhubQuote | null;
  metric: FinnhubBasicFinancials | null;
  news: FinnhubNewsItem[];
  rating: {
    ops_verdict: Verdict | null;
    ops_score: number | null;
    street_verdict: Verdict | null;
    street_score: number | null;
    quant_score: number | null;
    industry: string | null;
  } | null;
  grades: Partial<Record<FactorKey, Grade | null>>;
};

/** Parse `?symbols=A,B,C` 形式（去重 / 大写 / 截断到 COMPARE_MAX）。 */
export function parseCompareSymbols(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const flat = Array.isArray(raw) ? raw.join(",") : raw;
  const list = flat
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, COMPARE_MAX);
}

/** 平行拉每个 ticker 的全套数据。失败的字段返回 null，不阻塞其他 column。 */
export async function loadCompareData(symbols: string[]): Promise<CompareColumn[]> {
  const today = new Date();
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - 14);
  const isoFrom = past.toISOString().slice(0, 10);
  const isoTo = today.toISOString().slice(0, 10);

  return Promise.all(
    symbols.map(async (sym) => {
      const safe = <T,>(p: Promise<T>) => p.catch(() => null) as Promise<T | null>;
      const [ticker, profile, quote, metric, news, rating, gradesMap] = await Promise.all([
        safe(getTickerBySymbol(sym)),
        safe(fetchCompanyProfile(sym)),
        safe(getQuote(sym)),
        safe(fetchBasicFinancials(sym)),
        fetchCompanyNews(sym, isoFrom, isoTo, 4).catch(() => [] as FinnhubNewsItem[]),
        safe(getRating(sym)),
        safe(getFactorGrades(sym)),
      ]);

      const grades: Partial<Record<FactorKey, Grade | null>> = {};
      if (gradesMap) {
        for (const [factor, row] of gradesMap.entries()) {
          grades[factor] = (row?.grade_now ?? null) as Grade | null;
        }
      }

      return {
        symbol: sym,
        ticker: ticker ?? null,
        profile: profile ?? null,
        quote: quote ?? null,
        metric: metric ?? null,
        news,
        rating: rating
          ? {
              ops_verdict: rating.ops_verdict,
              ops_score: rating.ops_score == null ? null : Number(rating.ops_score),
              street_verdict: rating.street_verdict,
              street_score: rating.street_score == null ? null : Number(rating.street_score),
              quant_score: rating.quant_score == null ? null : Number(rating.quant_score),
              industry: rating.industry,
            }
          : null,
        grades,
      } satisfies CompareColumn;
    }),
  );
}
