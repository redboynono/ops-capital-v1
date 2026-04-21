import { mysqlQuery } from "@/lib/mysql";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type Verdict = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type Grade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F";

export const CORE_FACTORS = [
  "VALUATION",
  "GROWTH",
  "PROFITABILITY",
  "MOMENTUM",
  "REVISIONS",
] as const;
export const DIVIDEND_FACTORS = [
  "DIV_SAFETY",
  "DIV_GROWTH",
  "DIV_YIELD",
  "DIV_CONSISTENCY",
] as const;
export type FactorKey = (typeof CORE_FACTORS)[number] | (typeof DIVIDEND_FACTORS)[number];

export const FACTOR_LABELS: Record<FactorKey, string> = {
  VALUATION: "估值 Valuation",
  GROWTH: "成长 Growth",
  PROFITABILITY: "盈利 Profitability",
  MOMENTUM: "动量 Momentum",
  REVISIONS: "预期修正 Revisions",
  DIV_SAFETY: "安全 Safety",
  DIV_GROWTH: "增长 Growth",
  DIV_YIELD: "收益 Yield",
  DIV_CONSISTENCY: "连续性 Consistency",
};

export const VERDICT_LABELS: Record<Verdict, { zh: string; en: string; tone: "buy-strong" | "buy" | "hold" | "sell" | "sell-strong" }> = {
  STRONG_BUY:  { zh: "强烈买入", en: "STRONG BUY",  tone: "buy-strong" },
  BUY:         { zh: "买入",     en: "BUY",         tone: "buy" },
  HOLD:        { zh: "持有",     en: "HOLD",        tone: "hold" },
  SELL:        { zh: "卖出",     en: "SELL",        tone: "sell" },
  STRONG_SELL: { zh: "强烈卖出", en: "STRONG SELL", tone: "sell-strong" },
};

export type RatingRow = {
  symbol: string;
  ops_verdict: Verdict | null;
  ops_score: string | null;           // mysql decimal comes as string
  ops_target_price: string | null;
  street_verdict: Verdict | null;
  street_score: string | null;
  street_target_price: string | null;
  street_analyst_count: number | null;
  quant_score: string | null;
  rank_overall: number | null;
  rank_overall_total: number | null;
  rank_sector: number | null;
  rank_sector_total: number | null;
  rank_industry: number | null;
  rank_industry_total: number | null;
  industry: string | null;
  has_dividend: number; // 0/1
  notes: string | null;
  source: "MANUAL" | "AI" | "HYBRID" | "EXTERNAL";
  updated_at: string;
};

export type FactorGradeRow = {
  symbol: string;
  factor: FactorKey;
  grade_now: Grade | null;
  grade_3m: Grade | null;
  grade_6m: Grade | null;
  updated_at: string;
};

// ---------------------------------------------------------------
// Grade <-> Score helpers
// ---------------------------------------------------------------

const GRADE_TO_NUM: Record<Grade, number> = {
  "A+": 4.3, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F":  0.0,
};

/** Map a GPA-style 0–4.3 number back to 1.00–5.00 score (Seeking-Alpha style). */
export function gpaToScore(gpa: number) {
  // 0 -> 1.0,  4.3 -> 5.0  (linear)
  const s = 1 + (gpa / 4.3) * 4;
  return Math.max(1, Math.min(5, Number(s.toFixed(2))));
}

export function gradeToGpa(g: Grade | null | undefined): number | null {
  if (!g) return null;
  return GRADE_TO_NUM[g] ?? null;
}

/** Compute quant_score (1.00–5.00) from core factor grades (weighted). */
export function computeQuantScore(grades: Partial<Record<FactorKey, Grade | null>>): number | null {
  const weights: Record<(typeof CORE_FACTORS)[number], number> = {
    VALUATION: 0.25,
    GROWTH: 0.25,
    PROFITABILITY: 0.20,
    MOMENTUM: 0.15,
    REVISIONS: 0.15,
  };
  let sum = 0;
  let wUsed = 0;
  for (const f of CORE_FACTORS) {
    const g = grades[f];
    const gpa = gradeToGpa(g ?? null);
    if (gpa == null) continue;
    sum += gpa * weights[f];
    wUsed += weights[f];
  }
  if (wUsed === 0) return null;
  const weightedGpa = sum / wUsed;
  return gpaToScore(weightedGpa);
}

// ---------------------------------------------------------------
// Read
// ---------------------------------------------------------------

export async function getRating(symbol: string) {
  const rows = await mysqlQuery<RatingRow[]>(
    "select * from ticker_ratings where symbol = ? limit 1",
    [symbol],
  );
  return rows[0] ?? null;
}

export async function getFactorGrades(symbol: string) {
  const rows = await mysqlQuery<FactorGradeRow[]>(
    "select symbol, factor, grade_now, grade_3m, grade_6m, updated_at from ticker_factor_grades where symbol = ?",
    [symbol],
  );
  const map = new Map<FactorKey, FactorGradeRow>();
  for (const r of rows) map.set(r.factor, r);
  return map;
}

// ---------------------------------------------------------------
// Write
// ---------------------------------------------------------------

export type RatingInput = {
  ops_verdict?: Verdict | null;
  ops_score?: number | null;
  ops_target_price?: number | null;
  street_verdict?: Verdict | null;
  street_score?: number | null;
  street_target_price?: number | null;
  street_analyst_count?: number | null;
  quant_score?: number | null;
  rank_overall?: number | null;
  rank_overall_total?: number | null;
  rank_sector?: number | null;
  rank_sector_total?: number | null;
  rank_industry?: number | null;
  rank_industry_total?: number | null;
  industry?: string | null;
  has_dividend?: boolean;
  notes?: string | null;
  source?: "MANUAL" | "AI" | "HYBRID" | "EXTERNAL";
};

export async function upsertRating(symbol: string, data: RatingInput) {
  const cols: string[] = ["symbol"];
  const vals: unknown[] = [symbol];
  const updates: string[] = [];

  const assign = <K extends keyof RatingInput>(key: K, col: string, transform?: (v: RatingInput[K]) => unknown) => {
    if (!(key in data)) return;
    const raw = data[key];
    const v = transform ? transform(raw) : raw;
    cols.push(col);
    vals.push(v === undefined ? null : v);
    updates.push(`${col} = values(${col})`);
  };

  assign("ops_verdict", "ops_verdict");
  assign("ops_score", "ops_score");
  assign("ops_target_price", "ops_target_price");
  assign("street_verdict", "street_verdict");
  assign("street_score", "street_score");
  assign("street_target_price", "street_target_price");
  assign("street_analyst_count", "street_analyst_count");
  assign("quant_score", "quant_score");
  assign("rank_overall", "rank_overall");
  assign("rank_overall_total", "rank_overall_total");
  assign("rank_sector", "rank_sector");
  assign("rank_sector_total", "rank_sector_total");
  assign("rank_industry", "rank_industry");
  assign("rank_industry_total", "rank_industry_total");
  assign("industry", "industry");
  assign("has_dividend", "has_dividend", (v) => (v ? 1 : 0));
  assign("notes", "notes");
  assign("source", "source");

  const placeholders = cols.map(() => "?").join(", ");
  const updateSql = updates.length > 0 ? `on duplicate key update ${updates.join(", ")}` : "";

  await mysqlQuery(
    `insert into ticker_ratings (${cols.join(", ")}) values (${placeholders}) ${updateSql}`,
    vals,
  );
}

export async function upsertFactorGrade(
  symbol: string,
  factor: FactorKey,
  grades: { now?: Grade | null; m3?: Grade | null; m6?: Grade | null },
) {
  await mysqlQuery(
    `insert into ticker_factor_grades (symbol, factor, grade_now, grade_3m, grade_6m)
     values (?, ?, ?, ?, ?)
     on duplicate key update
       grade_now = values(grade_now),
       grade_3m  = values(grade_3m),
       grade_6m  = values(grade_6m)`,
    [symbol, factor, grades.now ?? null, grades.m3 ?? null, grades.m6 ?? null],
  );
}

export async function upsertFactorGrades(
  symbol: string,
  grades: Partial<Record<FactorKey, { now?: Grade | null; m3?: Grade | null; m6?: Grade | null }>>,
) {
  for (const key of Object.keys(grades) as FactorKey[]) {
    const g = grades[key];
    if (!g) continue;
    await upsertFactorGrade(symbol, key, g);
  }
}

/** Re-compute quant_score from factor grades and persist it back. */
export async function recomputeAndStoreQuantScore(symbol: string) {
  const map = await getFactorGrades(symbol);
  const grades: Partial<Record<FactorKey, Grade | null>> = {};
  for (const [k, v] of map.entries()) grades[k] = v.grade_now;
  const score = computeQuantScore(grades);
  await upsertRating(symbol, { quant_score: score });
  return score;
}
