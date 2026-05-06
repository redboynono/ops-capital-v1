import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import type { FactorKey, Grade, Verdict } from "@/lib/ratings";

type GradeSnapshot = { symbol: string; factor: FactorKey; grade: Grade };

/**
 * Append one snapshot per factor for the given symbol.
 * Called after every AI generation (manual or cron) so we build up a real
 * history of grade_now over time.
 */
export async function appendFactorGradeSnapshots(
  symbol: string,
  grades: Partial<Record<FactorKey, Grade | null>>,
): Promise<void> {
  const rows: GradeSnapshot[] = [];
  for (const [factor, grade] of Object.entries(grades) as [FactorKey, Grade | null][]) {
    if (!grade) continue;
    rows.push({ symbol, factor, grade });
  }
  if (rows.length === 0) return;

  const placeholders = rows.map(() => "(?, ?, ?, ?)").join(", ");
  const values: unknown[] = [];
  for (const r of rows) {
    values.push(randomUUID(), r.symbol, r.factor, r.grade);
  }
  await mysqlQuery(
    `insert into ticker_factor_grades_history (id, symbol, factor, grade) values ${placeholders}`,
    values,
  );
}

/**
 * Append a ratings-level snapshot (verdict / score / target / rank).
 * Lets us plot target-price trajectory and verdict changes over time.
 */
export async function appendRatingSnapshot(
  symbol: string,
  data: {
    ops_verdict: Verdict | null;
    ops_score: number | null;
    ops_target_price: number | null;
    street_verdict: Verdict | null;
    street_score: number | null;
    street_target_price: number | null;
    quant_score: number | null;
    rank_overall: number | null;
    rank_sector: number | null;
    rank_industry: number | null;
    industry: string | null;
    notes: string | null;
    source: "MANUAL" | "AI" | "CRON" | "HYBRID" | "EXTERNAL";
  },
): Promise<void> {
  await mysqlQuery(
    `insert into ticker_ratings_history
       (id, symbol, ops_verdict, ops_score, ops_target_price,
        street_verdict, street_score, street_target_price,
        quant_score, rank_overall, rank_sector, rank_industry,
        industry, notes, source)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      symbol,
      data.ops_verdict,
      data.ops_score,
      data.ops_target_price,
      data.street_verdict,
      data.street_score,
      data.street_target_price,
      data.quant_score,
      data.rank_overall,
      data.rank_sector,
      data.rank_industry,
      data.industry,
      data.notes,
      data.source,
    ],
  );
}

/**
 * Look up the grade closest to (but not after) the given days-ago mark.
 * Returns null if no snapshot exists that old.
 */
export async function getHistoricalGrade(
  symbol: string,
  factor: FactorKey,
  daysAgo: number,
): Promise<Grade | null> {
  const rows = await mysqlQuery<{ grade: string }[]>(
    `select grade from ticker_factor_grades_history
      where symbol = ? and factor = ?
        and captured_at <= date_sub(now(), interval ? day)
      order by captured_at desc
      limit 1`,
    [symbol, factor, daysAgo],
  );
  return (rows[0]?.grade as Grade | undefined) ?? null;
}

/**
 * Given factor => grade_now map, resolve grade_3m & grade_6m from history.
 */
export async function resolveHistoricalGrades(
  symbol: string,
  factors: FactorKey[],
): Promise<Record<FactorKey, { m3: Grade | null; m6: Grade | null }>> {
  const result = {} as Record<FactorKey, { m3: Grade | null; m6: Grade | null }>;
  await Promise.all(
    factors.map(async (f) => {
      const [m3, m6] = await Promise.all([
        getHistoricalGrade(symbol, f, 90),
        getHistoricalGrade(symbol, f, 180),
      ]);
      result[f] = { m3, m6 };
    }),
  );
  return result;
}
