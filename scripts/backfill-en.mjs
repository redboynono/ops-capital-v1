#!/usr/bin/env node
/**
 * OPS Alpha · 英文正文回填器
 * ------------------------------------------------------------
 * 给 kind='analysis' 且缺 content_en 的历史研报补 title_en / excerpt_en / content_en。
 * 优先级：被 X 推过的（live 英文推文指向）> 近期文章。
 *
 * 用法（容器内，跟 daily-content 同样方式）：
 *   docker cp /data/ops-alpha/scripts/backfill-en.mjs ops-alpha:/app/backfill-en.mjs
 *   docker exec -w /app ops-alpha node backfill-en.mjs [--days=14] [--limit=50] [--dry-run]
 *
 * 需要容器内 env：MYSQL_URL, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
 */

import mysql from "mysql2/promise";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const DAYS = Number(args.days ?? 14);
const LIMIT = Math.max(1, Number(args.limit ?? 50));
const DRY_RUN = args["dry-run"] === "true";
// 仅修复被截断的英文摘要/标题（不重译正文，成本低）
const FIX_EXCERPT = args["fix-excerpt"] === "true";
const MIN_EXCERPT = Number(args["min-excerpt"] ?? 40);

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY && !DRY_RUN) throw new Error("OPENAI_API_KEY not set (use --dry-run to preview only)");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasCjk(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

async function callTranslate(system, user, maxTokens = 16000, attempt = 1) {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.15,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if ((res.status === 529 || res.status === 429) && attempt < 3) {
      await sleep(10000);
      return callTranslate(system, user, maxTokens, attempt + 1);
    }
    throw new Error(`translate HTTP ${res.status}: ${text.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    if (data.base_resp.status_code === 2064 && attempt < 3) {
      await sleep(12000);
      return callTranslate(system, user, maxTokens, attempt + 1);
    }
    throw new Error(`MiniMax translate error ${data.base_resp.status_code}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty translation");
  return content.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
}

async function translateTitleExcerpt(title, excerpt) {
  const system =
    "Financial research editor. Output English only (Latin script); ticker symbols may remain.";
  const user = `Translate to English. Reply exactly:
EN_TITLE: <english title>
EN_EXCERPT: <english summary, 1-3 sentences>

Title: ${title}
Summary: ${(excerpt ?? "").slice(0, 500)}`;
  const raw = await callTranslate(system, user, 1024);
  const tM = raw.match(/^EN_TITLE:\s*(.+)$/im);
  const eM = raw.match(/EN_EXCERPT:\s*([\s\S]+)$/i);
  const titleEn = (tM?.[1] ?? title).trim();
  const excerptEn = (eM?.[1] ?? excerpt ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  return { titleEn, excerptEn };
}

// 从（中或英）markdown 正文取首个正文段落做摘要，确定性且永远完整
function excerptFromContent(md) {
  if (!md) return "";
  const body = md.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const firstPara =
    body.split(/\n\s*\n/).find((p) => {
      const t = p.trim();
      return t && !t.startsWith("#");
    }) ?? "";
  return firstPara
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

const CONTENT_CHUNK = 9000;

async function translateContentChunk(chunk, strict) {
  const system = strict
    ? "Institutional equity research editor. Translate markdown to English only. Preserve headings, lists, tables, numbers, tickers. No Chinese characters."
    : "Translate financial research markdown to English. Preserve markdown structure, numbers, and ticker symbols.";
  const user = `${strict ? "No Chinese characters in output.\n\n" : ""}Translate this markdown section to English. Start output with EN_MARKDOWN: then the translated markdown.

${chunk}`;
  const raw = await callTranslate(system, user, 16000);
  const cleaned = raw.replace(/^\s*```(?:markdown)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const marker = cleaned.match(/^EN_MARKDOWN:\s*\n?([\s\S]+)$/im);
  const bodyOut = (marker?.[1] ?? cleaned).trim();
  if (!bodyOut) throw new Error("empty markdown translation");
  return bodyOut;
}

async function translatePostContent(content) {
  if (!content?.trim()) return content ?? "";
  const chunks = [];
  if (content.length <= CONTENT_CHUNK) {
    chunks.push(content);
  } else {
    const parts = content.split(/(?=^## )/m);
    let buf = "";
    for (const part of parts) {
      if ((buf + part).length > CONTENT_CHUNK && buf) {
        chunks.push(buf);
        buf = part;
      } else {
        buf += part;
      }
    }
    if (buf) chunks.push(buf);
  }
  const out = [];
  for (const chunk of chunks) {
    let translated = await translateContentChunk(chunk, false);
    if (hasCjk(translated)) translated = await translateContentChunk(chunk, true);
    if (hasCjk(translated)) throw new Error("content translation still contains CJK");
    out.push(translated);
  }
  return out.join("\n\n").trim();
}

async function fixExcerpts(pool) {
  // 选取：有英文正文但英文摘要被截断（过短）的 analysis。
  // 直接从英文正文首段派生摘要，无需调模型（确定性、完整、零成本）。
  const [rows] = await pool.query(
    `select id, slug, content_en
       from posts
      where kind = 'analysis'
        and content_en is not null and content_en <> ''
        and (excerpt_en is null or char_length(excerpt_en) < ?)
      order by created_at desc
      limit ?`,
    [MIN_EXCERPT, LIMIT],
  );
  console.log(`> fix-excerpt (from content_en)  min=${MIN_EXCERPT} limit=${LIMIT} dryRun=${DRY_RUN}`);
  console.log(`> ${rows.length} post(s) with truncated excerpt_en\n`);

  if (DRY_RUN) {
    for (const r of rows) console.log(`  ${r.slug} -> "${excerptFromContent(r.content_en).slice(0, 70)}"`);
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tag = `[${i + 1}/${rows.length}] ${r.slug}`;
    const excerptEn = excerptFromContent(r.content_en);
    if (!excerptEn || excerptEn.length < 20) {
      failed++;
      console.error(`${tag} ✗ derived excerpt too short`);
      continue;
    }
    await pool.execute(`update posts set excerpt_en = ? where id = ?`, [excerptEn, r.id]);
    ok++;
    console.log(`${tag} ✓ "${excerptEn.slice(0, 70)}…"`);
  }
  console.log(`\n===== fix-excerpt done =====\nok: ${ok}\nfailed: ${failed}`);
}

async function main() {
  const pool = await mysql.createPool({ uri: MYSQL_URL, connectionLimit: 2 });

  if (FIX_EXCERPT) {
    await fixExcerpts(pool);
    await pool.end();
    return;
  }

  // 选取：缺 content_en 的 analysis，优先被 X 推过的，其次近 DAYS 天，按推过/时间排序
  const [rows] = await pool.query(
    `select p.id, p.slug, p.title, p.excerpt, p.content,
            (s.ref_key is not null) as tweeted, p.created_at
       from posts p
       left join (select distinct ref_key from social_ops_posts where content_type='analysis') s
         on s.ref_key = p.slug
      where p.kind = 'analysis'
        and (p.content_en is null or p.content_en = '')
        and (s.ref_key is not null or p.created_at >= now() - interval ? day)
      order by tweeted desc, p.created_at desc
      limit ?`,
    [DAYS, LIMIT],
  );

  console.log(`> backfill-en  days=${DAYS} limit=${LIMIT} dryRun=${DRY_RUN}`);
  console.log(`> ${rows.length} post(s) in scope\n`);

  if (DRY_RUN) {
    for (const r of rows) {
      console.log(`  ${r.tweeted ? "[X]" : "   "} ${r.slug}  (${(r.content ?? "").length} chars)`);
    }
    await pool.end();
    return;
  }

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tag = `[${i + 1}/${rows.length}] ${r.slug}${r.tweeted ? " [X]" : ""}`;
    try {
      const { titleEn, excerptEn: modelExcerpt } = await translateTitleExcerpt(r.title, r.excerpt);
      const contentEn = await translatePostContent(r.content);
      // 英文摘要优先取英文正文首段（确定性、完整），失败再回退模型摘要
      const excerptEn = excerptFromContent(contentEn) || modelExcerpt;
      await pool.execute(
        `update posts set title_en = ?, excerpt_en = ?, content_en = ? where id = ?`,
        [titleEn, excerptEn, contentEn, r.id],
      );
      ok++;
      console.log(`${tag} ✓ EN ${contentEn.length} chars`);
    } catch (e) {
      failed++;
      console.error(`${tag} ✗ ${e.message}`);
    }
    await sleep(1000);
  }

  await pool.end();
  console.log(`\n===== done =====`);
  console.log(`ok:     ${ok}`);
  console.log(`failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
