#!/usr/bin/env node
/**
 * Seed OPS Ratings by calling MiniMax and writing to MySQL directly.
 *
 * Run inside the ops-alpha container (env already set):
 *   docker cp scripts/seed-ratings.mjs ops-alpha:/app/seed-ratings.mjs
 *   docker exec -i -w /app ops-alpha node seed-ratings.mjs [SYMBOL1 SYMBOL2 ...]
 *
 * If no symbols given, uses DEFAULT_SYMBOLS below.
 */

import mysql from "mysql2/promise";

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 4096);

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

const DEFAULT_SYMBOLS = [
  "NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "AMD",
  "TSM", "AVGO", "NFLX", "CRM",
  "BABA", "PDD", "BIDU", "NIO", "LI",
  "TCEHY", "00700", "09988", "03690",
  "BTC", "ETH", "SOL",
];

// ---------------------------------------------------------------

const CORE_FACTORS = ["VALUATION", "GROWTH", "PROFITABILITY", "MOMENTUM", "REVISIONS"];
const DIVIDEND_FACTORS = ["DIV_SAFETY", "DIV_GROWTH", "DIV_YIELD", "DIV_CONSISTENCY"];
const ALL_FACTORS = [...CORE_FACTORS, ...DIVIDEND_FACTORS];
const VALID_VERDICTS = new Set(["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"]);
const VALID_GRADES = new Set([
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
]);
const GPA = {
  "A+": 4.3, "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F": 0.0,
};
const WEIGHTS = { VALUATION: 0.25, GROWTH: 0.25, PROFITABILITY: 0.2, MOMENTUM: 0.15, REVISIONS: 0.15 };

function computeQuant(grades) {
  let sum = 0, w = 0;
  for (const f of CORE_FACTORS) {
    const g = grades[f]?.now;
    if (!g || !(g in GPA)) continue;
    sum += GPA[g] * WEIGHTS[f];
    w += WEIGHTS[f];
  }
  if (w === 0) return null;
  const gpa = sum / w;
  const score = 1 + (gpa / 4.3) * 4;
  return Math.round(Math.max(1, Math.min(5, score)) * 100) / 100;
}

// ---------------------------------------------------------------

const systemPrompt = `# Role: 量化评级系统 · 严格 JSON 输出

你是一个类似 Seeking Alpha Quant 的股票评级引擎。基于训练知识里对该标的的公开信息（财报、估值、动量、分析师一致预期），给出最合理的评级。

## 输出要求（极其严格）
- **仅输出一个 JSON 对象**，不要 Markdown、不要解释、不要 <think>
- 所有字段都要给出；不知道的数值字段填 null，但评级字段必须给
- grade 只能是："A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"
- verdict 只能是："STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
- score 为 1.00–5.00 浮点数
- 3M/6M 要有合理的历史差异，不要照抄 now

## JSON Schema
{
  "ops_verdict": "BUY",
  "ops_score": 4.20,
  "ops_target_price": 180.00,
  "street_verdict": "STRONG_BUY",
  "street_score": 4.55,
  "street_target_price": 195.00,
  "street_analyst_count": 48,
  "industry": "Semiconductors",
  "rank_overall": 120,
  "rank_overall_total": 4200,
  "rank_sector": 8,
  "rank_sector_total": 620,
  "rank_industry": 2,
  "rank_industry_total": 52,
  "has_dividend": false,
  "factors": {
    "VALUATION":     { "now": "D",  "m3": "D-", "m6": "F"  },
    "GROWTH":        { "now": "A+", "m3": "A+", "m6": "A"  },
    "PROFITABILITY": { "now": "A+", "m3": "A+", "m6": "A+" },
    "MOMENTUM":      { "now": "B+", "m3": "A-", "m6": "A"  },
    "REVISIONS":     { "now": "A+", "m3": "A+", "m6": "A"  },
    "DIV_SAFETY":     null,
    "DIV_GROWTH":     null,
    "DIV_YIELD":      null,
    "DIV_CONSISTENCY":null
  },
  "notes": "一句话投资要点，<=60 字。"
}

## 硬约束
- 不要任何其他字段
- 不要包裹在 markdown code fence 中
- 字符串严格用双引号`;

// ---------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizeGrade(g) {
  if (typeof g !== "string") return null;
  const up = g.toUpperCase().replace("＋", "+").replace("－", "-");
  return VALID_GRADES.has(up) ? up : null;
}
function sanitizeVerdict(v) {
  if (typeof v !== "string") return null;
  return VALID_VERDICTS.has(v) ? v : null;
}
function sanitizeNum(n) {
  if (n == null || n === "") return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function extractJson(raw) {
  const s = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i < 0 || j <= i) throw new Error("no json object");
  return JSON.parse(s.slice(i, j + 1));
}

async function callModel(userPrompt, attempt = 1) {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: OPENAI_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 529 && attempt < 3) {
      await sleep(8000);
      return callModel(userPrompt, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    if (data.base_resp.status_code === 2064 && attempt < 3) {
      await sleep(10000);
      return callModel(userPrompt, attempt + 1);
    }
    throw new Error(`MiniMax ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty content");
  return content;
}

// ---------------------------------------------------------------

async function upsertRating(pool, symbol, r) {
  const cols = [
    "symbol", "ops_verdict", "ops_score", "ops_target_price",
    "street_verdict", "street_score", "street_target_price", "street_analyst_count",
    "quant_score",
    "rank_overall", "rank_overall_total",
    "rank_sector", "rank_sector_total",
    "rank_industry", "rank_industry_total",
    "industry", "has_dividend", "notes", "source",
  ];
  const vals = [
    symbol, r.ops_verdict, r.ops_score, r.ops_target_price,
    r.street_verdict, r.street_score, r.street_target_price, r.street_analyst_count,
    r.quant_score,
    r.rank_overall, r.rank_overall_total,
    r.rank_sector, r.rank_sector_total,
    r.rank_industry, r.rank_industry_total,
    r.industry, r.has_dividend ? 1 : 0, r.notes, "AI",
  ];
  const placeholders = cols.map(() => "?").join(", ");
  const updates = cols.filter((c) => c !== "symbol").map((c) => `${c}=values(${c})`).join(", ");
  await pool.execute(
    `insert into ticker_ratings (${cols.join(", ")}) values (${placeholders})
     on duplicate key update ${updates}`,
    vals,
  );
}

async function upsertFactorGrades(pool, symbol, factors) {
  for (const f of ALL_FACTORS) {
    const v = factors[f];
    if (!v) continue;
    const now = sanitizeGrade(v.now);
    const m3 = sanitizeGrade(v.m3);
    const m6 = sanitizeGrade(v.m6);
    if (!now && !m3 && !m6) continue;
    await pool.execute(
      `insert into ticker_factor_grades (symbol, factor, grade_now, grade_3m, grade_6m)
       values (?, ?, ?, ?, ?)
       on duplicate key update
         grade_now=values(grade_now), grade_3m=values(grade_3m), grade_6m=values(grade_6m)`,
      [symbol, f, now, m3, m6],
    );
  }
}

// ---------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const symbols = args.length > 0 ? args.map((s) => s.toUpperCase()) : DEFAULT_SYMBOLS;
  const pool = mysql.createPool(MYSQL_URL);

  // verify they exist in tickers table
  const [existing] = await pool.query(
    `select symbol, name, sector from tickers where symbol in (${symbols.map(() => "?").join(",")})`,
    symbols,
  );
  const byS = new Map(existing.map((t) => [t.symbol, t]));

  let ok = 0, fail = 0;
  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i];
    const t = byS.get(s);
    if (!t) {
      console.warn(`[${i + 1}/${symbols.length}] ${s} not in tickers table, skipping`);
      fail++;
      continue;
    }
    const tag = `[${i + 1}/${symbols.length}] ${s}`;
    try {
      const userPrompt = [
        `标的代码: ${s}`,
        `标的名称: ${t.name ?? ""}`,
        `所属板块: ${t.sector ?? ""}`,
        "",
        "请输出最新的 OPS Rating JSON（严格按 schema，只输出 JSON）。",
      ].join("\n");
      console.log(`${tag} generating...`);
      const raw = await callModel(userPrompt);
      const parsed = extractJson(raw);

      // clean factors
      const factorsClean = {};
      for (const f of ALL_FACTORS) {
        const v = parsed.factors?.[f];
        if (v && typeof v === "object") {
          factorsClean[f] = {
            now: sanitizeGrade(v.now),
            m3: sanitizeGrade(v.m3),
            m6: sanitizeGrade(v.m6),
          };
        } else {
          factorsClean[f] = null;
        }
      }
      const quant = computeQuant(factorsClean);

      const r = {
        ops_verdict: sanitizeVerdict(parsed.ops_verdict),
        ops_score: sanitizeNum(parsed.ops_score),
        ops_target_price: sanitizeNum(parsed.ops_target_price),
        street_verdict: sanitizeVerdict(parsed.street_verdict),
        street_score: sanitizeNum(parsed.street_score),
        street_target_price: sanitizeNum(parsed.street_target_price),
        street_analyst_count: sanitizeNum(parsed.street_analyst_count),
        quant_score: quant,
        rank_overall: sanitizeNum(parsed.rank_overall),
        rank_overall_total: sanitizeNum(parsed.rank_overall_total),
        rank_sector: sanitizeNum(parsed.rank_sector),
        rank_sector_total: sanitizeNum(parsed.rank_sector_total),
        rank_industry: sanitizeNum(parsed.rank_industry),
        rank_industry_total: sanitizeNum(parsed.rank_industry_total),
        industry: typeof parsed.industry === "string" ? parsed.industry : null,
        has_dividend: !!parsed.has_dividend,
        notes: typeof parsed.notes === "string" ? parsed.notes : null,
      };

      await upsertRating(pool, s, r);
      await upsertFactorGrades(pool, s, factorsClean);
      ok++;
      console.log(
        `${tag} ✓ verdict=${r.ops_verdict ?? "?"} ops=${r.ops_score ?? "?"} street=${r.street_score ?? "?"} quant=${quant ?? "?"}`,
      );
    } catch (e) {
      fail++;
      console.error(`${tag} ✗ ${e.message}`);
    }
    await sleep(600);
  }

  await pool.end();
  console.log(`\n===== done: ok=${ok} fail=${fail} =====`);
}

main().catch((e) => { console.error(e); process.exit(1); });
