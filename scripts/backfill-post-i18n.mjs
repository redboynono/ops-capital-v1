#!/usr/bin/env node
/**
 * 存量研报 title_en / excerpt_en 回填。
 *
 * 用法（生产容器内，需 MYSQL_URL + OPENAI_API_KEY）：
 *   docker cp scripts/lib ops-alpha:/app/lib
 *   docker cp scripts/backfill-post-i18n.mjs ops-alpha:/app/backfill-post-i18n.mjs
 *   docker exec -w /app ops-alpha node backfill-post-i18n.mjs --dry-run
 *   docker exec -d ops-alpha sh -c 'node /app/backfill-post-i18n.mjs --limit=300 --delay=400 >> /tmp/backfill.log 2>&1'
 *
 * 选项：
 *   --dry-run           只列出待回填，不写库
 *   --limit=N           最多处理 N 篇（默认 100）
 *   --delay=MS          每篇翻译间隔（默认 600ms）
 *   --slug=SLUG         只处理单篇
 *   --force             即使已有英文字段也重译
 *   --retranslate-cjk   重译 title_en/excerpt_en 仍含中文的条目
 */

import mysql from "mysql2/promise";
import { runJob } from "./lib/job-runner.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);

const DRY_RUN = args["dry-run"] === "true";
const FORCE = args.force === "true";
const RETRANSLATE_CJK = args["retranslate-cjk"] === "true";
const LIMIT = Math.max(1, Number(args.limit ?? 100));
const DELAY_MS = Math.max(0, Number(args.delay ?? 600));
const SLUG = args.slug?.trim() || null;

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";
const OPENAI_CHAT_PATH = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY && !DRY_RUN) throw new Error("OPENAI_API_KEY not set (use --dry-run to preview)");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hasCjk(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function parseLines(raw, title, excerpt) {
  const cleaned = raw.replace(/^\s*```[\s\S]*?```\s*/gm, "").trim();
  const titleM = cleaned.match(/^EN_TITLE:\s*(.+)$/im);
  const excerptM = cleaned.match(/^EN_EXCERPT:\s*([\s\S]+)$/im);
  if (!titleM || !excerptM) throw new Error("missing EN_TITLE/EN_EXCERPT lines");
  const excerptEn = excerptM[1].split(/\n{2,}/)[0].replace(/\n/g, " ").trim();
  return {
    titleEn: titleM[1].trim() || title,
    excerptEn: excerptEn || excerpt,
  };
}

async function callTranslate(title, excerpt, strict) {
  const res = await fetch(`${OPENAI_BASE_URL}${OPENAI_CHAT_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: strict
            ? "Financial editor. Reply with exactly two lines in English only (Latin script). Ticker symbols may remain."
            : "Translate financial research metadata to concise English.",
        },
        {
          role: "user",
          content: `Translate to English. Reply exactly:
EN_TITLE: <english title>
EN_EXCERPT: <english summary, 1-3 sentences>

${strict ? "No Chinese characters allowed.\n\n" : ""}Title: ${title}
Summary: ${excerpt.slice(0, 500)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("empty model output");
  return raw;
}

async function translateTitleExcerpt(title, excerpt) {
  let raw = await callTranslate(title, excerpt, false);
  let out = parseLines(raw, title, excerpt);
  if (hasCjk(out.titleEn) || hasCjk(out.excerptEn)) {
    raw = await callTranslate(title, excerpt, true);
    out = parseLines(raw, title, excerpt);
  }
  if (hasCjk(out.titleEn) || hasCjk(out.excerptEn)) {
    throw new Error("translation still contains CJK after strict retry");
  }
  return out;
}

async function listTargets(conn) {
  const wheres = ["kind = 'analysis'", "is_published = 1"];
  const params = [];
  if (SLUG) {
    wheres.push("slug = ?");
    params.push(SLUG);
  } else if (RETRANSLATE_CJK) {
    wheres.push("(title_en is not null and title_en != '' or excerpt_en is not null and excerpt_en != '')");
  } else if (!FORCE) {
    wheres.push("(title_en is null or trim(title_en) = '' or excerpt_en is null or trim(excerpt_en) = '')");
  }
  const fetchLimit = RETRANSLATE_CJK ? Math.min(500, LIMIT * 3) : LIMIT;
  const [rows] = await conn.query(
    `select id, slug, title, excerpt, title_en, excerpt_en
       from posts
      where ${wheres.join(" and ")}
      order by created_at desc
      limit ${fetchLimit}`,
    params,
  );
  if (RETRANSLATE_CJK) {
    return rows
      .filter((r) => hasCjk(r.title_en ?? "") || hasCjk(r.excerpt_en ?? ""))
      .slice(0, LIMIT);
  }
  return rows;
}

await runJob({ jobName: "backfill-post-i18n", mysqlUrl: MYSQL_URL }, async (ctx) => {
  const conn = await mysql.createConnection(MYSQL_URL);
  try {
    const targets = await listTargets(conn);
    ctx.itemsTotal = targets.length;
    console.log(
      `[backfill-post-i18n] targets=${targets.length} dry_run=${DRY_RUN} force=${FORCE} retranslate_cjk=${RETRANSLATE_CJK}`,
    );

    let ok = 0;
    let failed = 0;

    for (const row of targets) {
      const label = `${row.slug}`;
      try {
        if (DRY_RUN) {
          console.log(`  [dry-run] ${label} | ${row.title.slice(0, 48)}…`);
          ok++;
          continue;
        }

        const { titleEn, excerptEn } = await translateTitleExcerpt(row.title, row.excerpt);
        await conn.execute(`update posts set title_en = ?, excerpt_en = ? where id = ?`, [
          titleEn,
          excerptEn,
          row.id,
        ]);
        console.log(`  ✓ ${label}`);
        console.log(`    EN title: ${titleEn.slice(0, 72)}`);
        ok++;
        if (DELAY_MS > 0) await sleep(DELAY_MS);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
      }
    }

    ctx.itemsOk = ok;
    ctx.itemsFailed = failed;
    ctx.meta = { dryRun: DRY_RUN, force: FORCE, retranslateCjk: RETRANSLATE_CJK, limit: LIMIT, slug: SLUG };
  } finally {
    await conn.end();
  }
});
