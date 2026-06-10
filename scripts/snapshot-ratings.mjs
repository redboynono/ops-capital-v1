#!/usr/bin/env node
/**
 * Append current ticker_ratings + factor grades to history tables for all rated symbols.
 */
import mysql from "mysql2/promise";
import crypto from "node:crypto";
import { runJob } from "./lib/job-runner.mjs";

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) throw new Error("MYSQL_URL not set");

async function main(ctx) {
  const conn = await mysql.createConnection(MYSQL_URL);

  const [ratings] = await conn.execute(
    `select symbol, ops_verdict, ops_score, ops_target_price,
            street_verdict, street_score, street_target_price,
            quant_score, rank_overall, rank_sector, rank_industry,
            industry, notes, source
       from ticker_ratings
      where quant_score is not null or ops_verdict is not null`,
  );

  const [grades] = await conn.execute(
    `select symbol, factor, grade_now from ticker_factor_grades where grade_now is not null`,
  );

  let ok = 0;
  for (const r of ratings) {
    await conn.execute(
      `insert into ticker_ratings_history
         (id, symbol, ops_verdict, ops_score, ops_target_price,
          street_verdict, street_score, street_target_price,
          quant_score, rank_overall, rank_sector, rank_industry,
          industry, notes, source)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CRON')`,
      [
        crypto.randomUUID(),
        r.symbol,
        r.ops_verdict,
        r.ops_score,
        r.ops_target_price,
        r.street_verdict,
        r.street_score,
        r.street_target_price,
        r.quant_score,
        r.rank_overall,
        r.rank_sector,
        r.rank_industry,
        r.industry,
        r.notes,
      ],
    );
    ok++;
  }

  const gradeRows = [];
  for (const g of grades) {
    gradeRows.push([crypto.randomUUID(), g.symbol, g.factor, g.grade_now]);
  }
  if (gradeRows.length > 0) {
    const ph = gradeRows.map(() => "(?, ?, ?, ?)").join(", ");
    await conn.execute(
      `insert into ticker_factor_grades_history (id, symbol, factor, grade) values ${ph}`,
      gradeRows.flat(),
    );
  }

  await conn.execute(
    `update ticker_ratings set last_refreshed_at = current_timestamp(3) where quant_score is not null`,
  );

  await conn.end();
  console.log(`[snapshot] ratings=${ok}, factor_grades=${gradeRows.length}`);
  if (ctx) {
    ctx.itemsTotal = ratings.length;
    ctx.itemsOk = ok;
    ctx.meta = { factorSnapshots: gradeRows.length };
  }
}

runJob({ jobName: "snapshot-ratings", mysqlUrl: MYSQL_URL }, main).catch((e) => {
  console.error(e);
  process.exit(1);
});
