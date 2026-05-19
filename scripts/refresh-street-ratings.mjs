#!/usr/bin/env node
/**
 * Refresh street_verdict / street_score / street_target_price from Finnhub (US symbols).
 * HK numeric symbols are skipped (Finnhub free tier).
 */
import mysql from "mysql2/promise";
import { runJob } from "./lib/job-runner.mjs";

const MYSQL_URL = process.env.MYSQL_URL;
const TOKEN = process.env.FINNHUB_API_KEY ?? process.env.FINNHUB_TOKEN ?? "";
if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!TOKEN) throw new Error("FINNHUB_API_KEY not set");

const REC_TO_VERDICT = {
  5: "STRONG_BUY",
  4: "BUY",
  3: "HOLD",
  2: "SELL",
  1: "STRONG_SELL",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRecommendation(symbol) {
  const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${TOKEN}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const latest = arr[0];
  const strongBuy = Number(latest.strongBuy ?? 0);
  const buy = Number(latest.buy ?? 0);
  const hold = Number(latest.hold ?? 0);
  const sell = Number(latest.sell ?? 0);
  const strongSell = Number(latest.strongSell ?? 0);
  const total = strongBuy + buy + hold + sell + strongSell;
  if (!total) return null;
  const score =
    (5 * strongBuy + 4 * buy + 3 * hold + 2 * sell + 1 * strongSell) / total;
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return {
    street_verdict: REC_TO_VERDICT[rounded] ?? "HOLD",
    street_score: Number(score.toFixed(2)),
    street_analyst_count: total,
  };
}

async function fetchTarget(symbol) {
  const url = `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${TOKEN}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const j = await res.json();
  const t = Number(j?.targetMean ?? j?.targetHigh ?? 0);
  return t > 0 ? t : null;
}

async function main(ctx) {
  const conn = await mysql.createConnection(MYSQL_URL);
  const [symbols] = await conn.execute(
    `select symbol from tickers where exchange in ('NASDAQ','NYSE') order by symbol`,
  );

  let ok = 0;
  let fail = 0;
  for (const { symbol } of symbols) {
    if (/^\d{4,5}$/.test(symbol)) continue;
    try {
      const [rec, target] = await Promise.all([
        fetchRecommendation(symbol),
        fetchTarget(symbol),
      ]);
      if (!rec && target == null) {
        fail++;
        await sleep(1100);
        continue;
      }
      await conn.execute(
        `update ticker_ratings set
           street_verdict = coalesce(?, street_verdict),
           street_score = coalesce(?, street_score),
           street_analyst_count = coalesce(?, street_analyst_count),
           street_target_price = coalesce(?, street_target_price),
           updated_at = current_timestamp
         where symbol = ?`,
        [
          rec?.street_verdict ?? null,
          rec?.street_score ?? null,
          rec?.street_analyst_count ?? null,
          target,
          symbol,
        ],
      );
      ok++;
    } catch (e) {
      console.warn(`[street] ${symbol}:`, e.message);
      fail++;
    }
    await sleep(1100);
  }

  await conn.end();
  console.log(`[refresh-street] ok=${ok} fail=${fail}`);
  if (ctx) {
    ctx.itemsTotal = symbols.length;
    ctx.itemsOk = ok;
    ctx.itemsFailed = fail;
  }
}

runJob({ jobName: "refresh-street-ratings", mysqlUrl: MYSQL_URL }, main).catch((e) => {
  console.error(e);
  process.exit(1);
});
