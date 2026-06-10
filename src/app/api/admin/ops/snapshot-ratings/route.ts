import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { appendFactorGradeSnapshots, appendRatingSnapshot } from "@/lib/ratingsSnapshot";
import { mysqlQuery } from "@/lib/mysql";
import { CORE_FACTORS, type FactorKey, type Grade, getFactorGrades, type RatingRow } from "@/lib/ratings";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const ratings = await mysqlQuery<RatingRow[]>(
    `select symbol, ops_verdict, ops_score, ops_target_price,
            street_verdict, street_score, street_target_price,
            quant_score, rank_overall, rank_sector, rank_industry,
            industry, notes, source
       from ticker_ratings
      where quant_score is not null or ops_verdict is not null`,
  );

  let count = 0;
  for (const r of ratings) {
    await appendRatingSnapshot(r.symbol, {
      ops_verdict: r.ops_verdict,
      ops_score: r.ops_score ? Number(r.ops_score) : null,
      ops_target_price: r.ops_target_price ? Number(r.ops_target_price) : null,
      street_verdict: r.street_verdict,
      street_score: r.street_score ? Number(r.street_score) : null,
      street_target_price: r.street_target_price ? Number(r.street_target_price) : null,
      quant_score: r.quant_score ? Number(r.quant_score) : null,
      rank_overall: r.rank_overall,
      rank_sector: r.rank_sector,
      rank_industry: r.rank_industry,
      industry: r.industry,
      notes: r.notes,
      source: "CRON",
    });
    const grades = await getFactorGrades(r.symbol);
    const factorsNow: Partial<Record<FactorKey, Grade | null>> = {};
    for (const f of CORE_FACTORS) {
      const g = grades.get(f);
      if (g?.grade_now) factorsNow[f] = g.grade_now;
    }
    await appendFactorGradeSnapshots(r.symbol, factorsNow);
    count++;
  }

  await mysqlQuery(`update ticker_ratings set last_refreshed_at = current_timestamp(3) where quant_score is not null`);

  return NextResponse.json({ ok: true, snapshotted: count });
}
