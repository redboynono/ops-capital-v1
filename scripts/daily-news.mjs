#!/usr/bin/env node
/**
 * OPS Alpha · 每日市场快讯生成器
 * ------------------------------------------------------------
 * 与 daily-content.mjs 同源，但产物是短篇市场快讯 (kind='news')：
 *   - 每条 300-800 字
 *   - 事件驱动风格：观察 → 解读 → 对标的的影响
 *   - 全部 free（快讯负责引流，深度研报负责变现）
 *   - 一个时段允许多条，slug 拼上 HHmm
 *
 * 选标策略：跟 daily-content 不冲突。每次随机 N 个，避免每小时都同样 ticker
 *   score = days_since_last_news + 抖动
 *
 * 用法（host 上跑）：
 *   docker cp /data/ops-alpha/scripts/daily-news.mjs ops-alpha:/tmp/daily-news.mjs
 *   docker exec -i ops-alpha node /tmp/daily-news.mjs [--count=2] [--dry-run] [--tickers=NVDA,TSM]
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";

// ============================== args ============================== //

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const COUNT = Math.min(8, Math.max(1, Number(args.count ?? 2)));
const DRY_RUN = args["dry-run"] === "true";
const MANUAL_TICKERS = args.tickers
  ? args.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  : null;

// ============================== config ============================== //

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_NEWS_MAX_TOKENS ?? 2000);

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY && !DRY_RUN) throw new Error("OPENAI_API_KEY not set (use --dry-run to preview)");

// ============================== prompts ============================== //

const SYSTEM_PROMPT = `# Role: 一线交易台资深市场快讯撰稿人

## Profile
你是华尔街交易台一线 desk strategist，每日为机构客户写"盘前/盘中/盘后"市场快讯。语言冷峻、信息密度高、不堆砌套话。

## Output 规则
- 首行 # 标题：<=30 字，必须包含具体动作或数据点（避免"宏观博弈""定价重估"这种空话）
- 正文 400-700 字，三段式：
  1. **事件**（What）：用 1-3 句话陈述今天/最近发生了什么——发布会、季报数据、政策变化、链上活动、机构持仓变动等
  2. **解读**（Why）：拆 1-2 个真正驱动股价/币价的变量
  3. **对标的的影响**（So what）：明确给出短期（1-4 周）方向判断 + 关键观察指标
- 不需要免责声明、不需要"投资有风险"
- 不需要重复 ticker 名称作为标题前缀
- 用 Markdown，可以用 1-2 个二级小标题

## Tone
- 冷酷、点到即止、像 Bloomberg terminal 上的 desk note
- 数字第一，叙事第二
- 严禁出现"我认为""请注意""综上所述""总而言之"这类口水话`;

// 行业 × 视角矩阵：让快讯有切入角度，不是干巴巴"今天涨了"
const NEWS_ANGLES = {
  Semiconductors: [
    "近期产能利用率与代工厂排单变化",
    "HBM / 先进封装订单的最新流出迹象",
    "地缘政策对供应链的边际冲击",
    "AI 推理需求向客户端的迁移信号",
  ],
  Software: [
    "Copilot / AI Agent 落地客户数最新口径",
    "云业务季度递延收入增速变化",
    "并购整合的协同里程碑",
    "开源替代品对核心 SKU 的渗透",
  ],
  Internet: [
    "广告 eCPM 周环比方向",
    "短视频 / 直播商业化 take rate 边际变化",
    "海外扩张监管动态",
    "AI 搜索对核心入口的反哺或蚕食",
  ],
  "Consumer Tech": [
    "渠道库存周转最新读数",
    "服务收入占比的边际变化",
    "新品发布会预期博弈",
    "供应链区域转移的进度",
  ],
  Auto: [
    "周度交付与降价幅度",
    "Robotaxi / FSD 监管落地节奏",
    "电池供应链价格变动",
    "出口关税情景演化",
  ],
  "E-commerce": [
    "GMV 周度环比与用户活跃度",
    "Take Rate 调整传闻",
    "跨境业务单位经济模型变化",
    "AI 广告工具对中小商家的实测效果",
  ],
  Crypto: [
    "ETF 资金流近期净流入 / 流出",
    "链上活跃地址与 gas 费方向",
    "稳定币市值与 RWA 链上增量",
    "监管事件（SEC / MiCA）最新进展",
  ],
  GENERIC: [
    "持仓结构与机构调仓信号",
    "估值分位与同业相对位置变化",
    "近期新闻流情绪面",
    "下一轮催化剂的时间窗",
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toISOString().slice(0, 10);
const todayStamp = () => todayISO().replace(/-/g, "");
const hourMinStamp = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildAngle(ticker) {
  const sectorAngles = NEWS_ANGLES[ticker.sector] ?? NEWS_ANGLES.GENERIC;
  return pick(sectorAngles);
}

function buildTarget(ticker) {
  return ticker.name && ticker.name !== ticker.symbol
    ? `${ticker.symbol} ${ticker.name}`
    : ticker.symbol;
}

function parseOutput(raw) {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
  const lines = cleaned.split("\n");
  let title = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1].trim();
      bodyStart = i + 1;
      break;
    }
  }
  if (!title) {
    title = (lines.find((l) => l.trim()) ?? "(untitled)").replace(/^#+\s*/, "").slice(0, 30);
    bodyStart = 1;
  }
  const body = lines.slice(bodyStart).join("\n").trim();
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "";
  const excerpt = firstPara
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return { title, body: cleaned, excerpt };
}

async function callMiniMax(target, angle, attempt = 1) {
  const userPrompt = `请为以下标的撰写一条市场快讯（盘中 desk note 风格）：\n标的：${target}\n切入角度：${angle}\n今日日期：${todayISO()}\n严格按 system prompt 的"事件 / 解读 / 对标的的影响"三段式，正文 400-700 字。首行为 # 标题。`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.55,
      max_tokens: OPENAI_MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if ((res.status === 529 || res.status === 429) && attempt < 3) {
      console.warn(`  [${res.status}] retry ${attempt}/2 in 10s...`);
      await sleep(10000);
      return callMiniMax(target, angle, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    const msg = data.base_resp.status_msg ?? "unknown";
    if (data.base_resp.status_code === 2064 && attempt < 3) {
      console.warn(`  [overloaded:2064] retry ${attempt}/2 in 12s...`);
      await sleep(12000);
      return callMiniMax(target, angle, attempt + 1);
    }
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty content");
  return content;
}

// ============================== selection ============================== //

async function selectCandidates(pool, count) {
  const [tickers] = await pool.query(
    "select symbol, name, exchange, sector from tickers order by symbol",
  );
  if (tickers.length === 0) throw new Error("no tickers in DB");

  // 上一次 news 覆盖时间（按 ticker）
  const [lastRows] = await pool.query(`
    select pt.symbol, max(p.created_at) as last_at
    from post_tickers pt
    join posts p on p.id = pt.post_id
    where p.kind = 'news' and p.is_published = 1
    group by pt.symbol
  `);
  const lastMap = new Map();
  for (const r of lastRows) lastMap.set(r.symbol, new Date(r.last_at).getTime());

  // 本时段已经覆盖的 ticker（同 HHmm 内不重复）
  const stamp = `${todayStamp()}-${hourMinStamp().slice(0, 2)}`; // 同小时内不重复
  const [recentRows] = await pool.query(
    "select slug from posts where kind = 'news' and slug like ?",
    [`news-%-${stamp}%`],
  );
  const coveredThisHour = new Set(
    recentRows
      .map((r) => {
        const m = r.slug.match(/^news-(.+)-\d{8}-\d{4}$/);
        return m ? m[1].toUpperCase() : null;
      })
      .filter(Boolean),
  );

  const now = Date.now();
  const HOUR = 3600000;

  const scored = tickers
    .filter((t) => !coveredThisHour.has(t.symbol.toUpperCase()))
    .map((t) => {
      const lastAt = lastMap.get(t.symbol);
      const hours = lastAt ? Math.max(0, Math.floor((now - lastAt) / HOUR)) : 720;
      const jitter = Math.random() * 12;
      const score = hours + jitter;
      return { ...t, hours, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count);
}

async function selectManual(pool, symbols) {
  const [rows] = await pool.query(
    `select symbol, name, exchange, sector from tickers where symbol in (${symbols.map(() => "?").join(",")})`,
    symbols,
  );
  return rows.map((r) => ({ ...r, hours: null, score: null }));
}

// ============================== main ============================== //

async function main() {
  console.log(`> OPS Alpha daily news generator`);
  console.log(`> date=${todayISO()}  hhmm=${hourMinStamp()}  count=${COUNT}  dryRun=${DRY_RUN}  manual=${MANUAL_TICKERS ? MANUAL_TICKERS.join(",") : "(auto)"}`);
  const pool = mysql.createPool(MYSQL_URL);

  const candidates = MANUAL_TICKERS
    ? await selectManual(pool, MANUAL_TICKERS)
    : await selectCandidates(pool, COUNT);

  if (candidates.length === 0) {
    console.log("no candidates — all tickers covered this hour. exiting.");
    await pool.end();
    return;
  }

  console.log(`\n> selected ${candidates.length} ticker(s):`);
  for (const c of candidates) {
    console.log(`  ${c.symbol.padEnd(8)} ${(c.sector ?? "-").padEnd(16)} hours_since=${c.hours ?? "-"}  score=${c.score?.toFixed?.(2) ?? "-"}`);
  }

  if (DRY_RUN) {
    console.log("\n> dry-run: no API call, no DB write.");
    await pool.end();
    return;
  }

  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i++) {
    const t = candidates[i];
    const target = buildTarget(t);
    const angle = buildAngle(t);
    const tag = `[${i + 1}/${candidates.length}] ${t.symbol}`;

    const safeSym = t.symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug = `news-${safeSym}-${todayStamp()}-${hourMinStamp()}`;
    const [existing] = await pool.query("select id from posts where slug = ? limit 1", [slug]);
    if (existing.length > 0) {
      console.log(`${tag} skipped: slug exists (${slug})`);
      continue;
    }

    try {
      console.log(`${tag} generating — angle: ${angle}`);
      const raw = await callMiniMax(target, angle);
      const { title, body, excerpt } = parseOutput(raw);
      if (!title || !body || body.length < 200) {
        console.warn(`${tag} output too short (${body?.length ?? 0} chars), skipping`);
        failed++;
        continue;
      }

      const id = crypto.randomUUID();
      await pool.execute(
        `insert into posts (id, title, slug, kind, excerpt, content, is_premium, is_published)
         values (?, ?, ?, 'news', ?, ?, 0, 1)`,
        [id, title, slug, excerpt, body],
      );
      await pool.execute(
        `insert ignore into post_tickers (post_id, symbol) values (?, ?)`,
        [id, t.symbol],
      );
      inserted++;
      console.log(`${tag} ✓ "${title}" (${body.length} chars)  slug=${slug}`);
    } catch (err) {
      failed++;
      console.error(`${tag} ✗ ${err.message}`);
    }
    await sleep(1000);
  }

  await pool.end();
  console.log(`\n===== done =====`);
  console.log(`inserted: ${inserted}`);
  console.log(`failed:   ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
