#!/usr/bin/env node
/**
 * Recompute rank_overall / rank_sector / rank_industry from quant_score (real sort, not AI fiction).
 */
import mysql from "mysql2/promise";
import { runJob } from "./lib/job-runner.mjs";

const MYSQL_URL = process.env.MYSQL_URL;
if (!MYSQL_URL) throw new Error("MYSQL_URL not set");

function rankList(rows, scoreKey) {
  const sorted = [...rows]
    .filter((r) => r[scoreKey] != null)
    .sort((a, b) => Number(b[scoreKey]) - Number(a[scoreKey]));
  const total = sorted.length;
  const map = new Map();
  sorted.forEach((r, i) => map.set(r.symbol, { rank: i + 1, total }));
  return map;
}

async function main(ctx) {
  const conn = await mysql.createConnection(MYSQL_URL);
  const [rows] = await conn.execute(
    `select r.symbol, r.quant_score, r.industry, t.sector
       from ticker_ratings r
       inner join tickers t on t.symbol = r.symbol
      where r.quant_score is not null`,
  );

  const overall = rankList(rows, "quant_score");
  const bySector = new Map();
  const byIndustry = new Map();
  for (const r of rows) {
    const sk = r.sector ?? "OTHER";
    if (!bySector.has(sk)) bySector.set(sk, []);
    bySector.get(sk).push(r);
    const ik = r.industry ?? "Unknown";
    if (!byIndustry.has(ik)) byIndustry.set(ik, []);
    byIndustry.get(ik).push(r);
  }

  const sectorRanks = new Map();
  for (const [k, list] of bySector) {
    for (const [sym, v] of rankList(list, "quant_score")) {
      sectorRanks.set(sym, v);
    }
  }
  const industryRanks = new Map();
  for (const [k, list] of byIndustry) {
    for (const [sym, v] of rankList(list, "quant_score")) {
      industryRanks.set(sym, v);
    }
  }

  let updated = 0;
  for (const r of rows) {
    const o = overall.get(r.symbol);
    const s = sectorRanks.get(r.symbol);
    const i = industryRanks.get(r.symbol);
    await conn.execute(
      `update ticker_ratings set
         rank_overall = ?, rank_overall_total = ?,
         rank_sector = ?, rank_sector_total = ?,
         rank_industry = ?, rank_industry_total = ?
       where symbol = ?`,
      [
        o?.rank ?? null,
        o?.total ?? null,
        s?.rank ?? null,
        s?.total ?? null,
        i?.rank ?? null,
        i?.total ?? null,
        r.symbol,
      ],
    );
    updated++;
  }

  await conn.end();
  console.log(`[recompute-ranks] updated ${updated} symbols`);
  if (ctx) {
    ctx.itemsTotal = rows.length;
    ctx.itemsOk = updated;
  }
}

runJob({ jobName: "recompute-ranks", mysqlUrl: MYSQL_URL }, main).catch((e) => {
  console.error(e);
  process.exit(1);
});
