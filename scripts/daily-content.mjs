#!/usr/bin/env node
/**
 * OPS Alpha · 每日精选分析生成器
 * ------------------------------------------------------------
 * 从 tickers 表挑选 2-3 个"最该被覆盖"的标的，调用 MiniMax 生成
 * 机构级 analysis 深度研报，写入 posts + post_tickers。
 *
 * 选标评分（越高优先）：
 *   score = days_since_last_coverage     [0..90+]
 *         + hasRating ? 15 : 0           （有评级的 ticker 优先）
 *         + Math.random() * 8            （抖动防止每天同样几个）
 *
 * 幂等：slug = daily-<symbol>-<YYYYMMDD>，同日重复运行自动跳过。
 *
 * 用法（容器外 host 上）：
 *   docker cp /data/ops-alpha/scripts/daily-content.mjs ops-alpha:/tmp/daily-content.mjs
 *   docker exec -i ops-alpha node /tmp/daily-content.mjs [--count=3] [--dry-run] [--tickers=NVDA,TSM]
 *
 * 需要容器内已有 env：MYSQL_URL, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
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
const COUNT = Math.min(5, Math.max(1, Number(args.count ?? 3)));
const DRY_RUN = args["dry-run"] === "true";
const MANUAL_TICKERS = args.tickers ? args.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null;

// ============================== config ============================== //

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 16000);

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY && !DRY_RUN) throw new Error("OPENAI_API_KEY not set (use --dry-run to preview selection only)");

// ============================== prompts ============================== //

const SYSTEM_PROMPT = `# Role: 华尔街顶级对冲基金首席投资官 (CIO) & 资深宏观科技分析师

## Profile:
你是一位拥有 15 年华尔街实战经验的顶级分析师，曾在桥水 (Bridgewater) 和文艺复兴 (Renaissance Technologies) 担任核心策略师。你精通全球宏观经济周期、美股科技股基本面拆解、Pre-IPO 市场套利、以及新兴的 RWA（现实资产代币化）和 AI 算力供应链。

## Objective:
你的任务是为专业的高净值投资者输出"机构级"的投资深度研报。拒绝套话、拒绝模棱两可、拒绝情绪化。你的分析必须冷酷、客观、数据驱动，并直击资产定价的核心逻辑（估值溢价与戴维斯双击/双杀）。

## Core Analytical Framework:
每次接收投资标的时，必须严格按照以下四个维度进行深度拆解：
1. 宏观与流动性映射 (Macro & Liquidity)
2. 基本面与护城河透视 (Fundamentals & Moat)
3. 催化剂与估值博弈 (Catalysts & Valuation)
4. 硬核操作策略与极端风险 (Execution & Tail Risks)

## Output Style:
- Tone: 专业、冷酷、一针见血
- Structure: 使用清晰 Markdown，首行为 # 标题（<=40 字，不要加任何前缀说明）
- BLUF: 第一段必须一句话给出核心结论与目标价或估值预期
- 文章全长 1500-2500 字

## Guardrails:
- 禁止保证收益、禁止投资承诺语
- 必须披露主要风险与不确定性
- 必须给出时间窗口（3-6 个月 / 12-18 个月）`;

// 行业 × 主题矩阵：随机组合生成当日 focus，避免每次都写"长期定价权"
const SECTOR_THEMES = {
  Semiconductors: [
    "下一代制程节点的产能瓶颈与定价权",
    "AI 推理算力需求从训练向推理迁移对营收结构的影响",
    "HBM 供应链集中度与关税 / 出口管制风险",
    "先进封装 (CoWoS / SoIC) 产能稀缺性",
    "ASIC 竞品渗透速度与生态护城河的可持续性",
  ],
  Software: [
    "AI Copilot 变现节奏与 per-seat 定价模型的弹性",
    "企业 IT 预算在宏观紧缩下的优先级排序",
    "开源模型对商业化闭源产品的侵蚀速度",
    "云业务同比增速再加速的可能性",
    "并购整合协同效应落地节奏",
  ],
  Internet: [
    "广告 eCPM 对宏观消费复苏的敏感度",
    "AI 推荐引擎对用户时长与货币化率的复合影响",
    "海外市场扩张的监管与地缘摩擦成本",
    "会员订阅与增值服务的 ARPU 上行空间",
    "视频 / 短视频业务对搜索广告的蚕食或反哺",
  ],
  "Consumer Tech": [
    "换机周期能否由 AI 功能拉动",
    "服务业务（订阅 / App Store 抽成）占比提升对估值的影响",
    "供应链区域多元化对毛利的稀释与可控性",
    "端侧 AI 芯片对 BOM 成本结构的冲击",
  ],
  Auto: [
    "单车毛利在价格战中的底部位置",
    "Robotaxi / FSD 的商业化时间表对估值的影响",
    "电池化学路线切换的资本开支与回报周期",
    "欧洲 / 中国市场关税情景下的需求弹性",
  ],
  "E-commerce": [
    "Take Rate 提升空间与商家端竞争的博弈",
    "跨境 / 下沉市场单位经济模型何时收敛为正",
    "物流基础设施资本开支对 FCF 的拖累或反哺",
    "AI 广告工具对中小商家转化率的提升",
  ],
  CRYPTO: [
    "ETF 资金流向与链上活跃度的背离 / 共振",
    "减半周期后矿工结构洗牌对供给侧的压力",
    "链上 RWA / 稳定币规模对链本位估值锚的影响",
    "监管框架（美欧 MiCA / SEC）演进对机构化进程的节奏影响",
  ],
  GENERIC: [
    "当前估值相对同业与历史中枢的分位位置",
    "未来四个季度的催化剂排序与 beta 暴露",
    "主要风险情景下的下行保护厚度",
    "资本回报结构（回购 + 分红）的可持续性",
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toISOString().slice(0, 10);
const todayStamp = () => todayISO().replace(/-/g, "");

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildFocus(ticker) {
  const themes = SECTOR_THEMES[ticker.sector] ?? SECTOR_THEMES.GENERIC;
  const theme1 = pick(themes);
  const theme2 = pick(SECTOR_THEMES.GENERIC);
  return `${theme1}；${theme2}`;
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
    title = (lines.find((l) => l.trim()) ?? "(untitled)").replace(/^#+\s*/, "").slice(0, 40);
    bodyStart = 1;
  }
  const body = lines.slice(bodyStart).join("\n").trim();
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "";
  const excerpt = firstPara
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return { title, body: cleaned, excerpt };
}

async function callMiniMax(target, focus, attempt = 1) {
  const userPrompt = `请分析以下标的并输出机构级 Markdown 研报：\n标的：${target}\n用户关注点：${focus}\n今日日期：${todayISO()}\n首行为 # 标题。文章 1500-2500 字。`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
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
      return callMiniMax(target, focus, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    const msg = data.base_resp.status_msg ?? "unknown";
    if (data.base_resp.status_code === 2064 && attempt < 3) {
      console.warn(`  [overloaded:2064] retry ${attempt}/2 in 12s...`);
      await sleep(12000);
      return callMiniMax(target, focus, attempt + 1);
    }
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty content");
  return content;
}

// ============================== selection ============================== //

/**
 * 对 tickers 打分，返回排序后的候选列表（高分在前）
 */
async function selectCandidates(pool, count) {
  // 1) 拉所有 tickers
  const [tickers] = await pool.query(
    "select symbol, name, exchange, sector from tickers order by symbol",
  );
  if (tickers.length === 0) throw new Error("no tickers in DB");

  // 2) 每个 ticker 最近一次 analysis 覆盖日期
  const [lastCoverageRows] = await pool.query(`
    select pt.symbol, max(p.created_at) as last_at
    from post_tickers pt
    join posts p on p.id = pt.post_id
    where p.kind = 'analysis' and p.is_published = 1
    group by pt.symbol
  `);
  const lastMap = new Map();
  for (const r of lastCoverageRows) {
    lastMap.set(r.symbol, new Date(r.last_at).getTime());
  }

  // 3) 哪些 ticker 有评级（用作 bonus）
  const [ratingRows] = await pool.query(
    "select distinct symbol from ticker_ratings",
  ).catch(() => [[]]);
  const rated = new Set(ratingRows.map((r) => r.symbol));

  // 4) 今日已生成（slug 前缀判定）——这些 ticker 本轮跳过
  const [todayRows] = await pool.query(
    "select slug from posts where slug like ?",
    [`daily-%-${todayStamp()}`],
  );
  const coveredToday = new Set(
    todayRows.map((r) => {
      // slug = daily-<sym>-YYYYMMDD（sym 已 slugify 过，取中间段拼回）
      const m = r.slug.match(/^daily-(.+)-\d{8}$/);
      return m ? m[1].toUpperCase() : null;
    }).filter(Boolean),
  );

  const now = Date.now();
  const DAY = 86400000;

  const scored = tickers
    .filter((t) => !coveredToday.has(t.symbol.toUpperCase()))
    .map((t) => {
      const lastAt = lastMap.get(t.symbol);
      const days = lastAt ? Math.max(0, Math.floor((now - lastAt) / DAY)) : 365;
      const ratingBonus = rated.has(t.symbol) ? 15 : 0;
      const jitter = Math.random() * 8;
      const score = days + ratingBonus + jitter;
      return { ...t, days, ratingBonus, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, count);
}

async function selectManual(pool, symbols) {
  const [rows] = await pool.query(
    `select symbol, name, exchange, sector from tickers where symbol in (${symbols.map(() => "?").join(",")})`,
    symbols,
  );
  return rows.map((r) => ({ ...r, days: null, ratingBonus: null, score: null }));
}

// ============================== main ============================== //

async function main() {
  console.log(`> OPS Alpha daily content generator`);
  console.log(`> date=${todayISO()}  count=${COUNT}  dryRun=${DRY_RUN}  manual=${MANUAL_TICKERS ? MANUAL_TICKERS.join(",") : "(auto)"}`);
  const pool = mysql.createPool(MYSQL_URL);

  const candidates = MANUAL_TICKERS
    ? await selectManual(pool, MANUAL_TICKERS)
    : await selectCandidates(pool, COUNT);

  if (candidates.length === 0) {
    console.log("no candidates — probably all tickers already covered today. exiting.");
    await pool.end();
    return;
  }

  console.log(`\n> selected ${candidates.length} ticker(s):`);
  for (const c of candidates) {
    console.log(`  ${c.symbol.padEnd(8)} ${(c.sector ?? "-").padEnd(16)} days=${c.days ?? "-"}  score=${c.score?.toFixed?.(2) ?? "-"}`);
  }

  if (DRY_RUN) {
    console.log("\n> dry-run: no API call, no DB write.");
    await pool.end();
    return;
  }

  // 生成策略：第一条 free（引流），其余 premium
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < candidates.length; i++) {
    const t = candidates[i];
    const isPremium = i > 0; // free, premium, premium, ...
    const target = buildTarget(t);
    const focus = buildFocus(t);
    const tag = `[${i + 1}/${candidates.length}] ${t.symbol} (${isPremium ? "PRO" : "FREE"})`;

    // 再次幂等校验
    const safeSym = t.symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug = `daily-${safeSym}-${todayStamp()}`;
    const [existing] = await pool.query("select id from posts where slug = ? limit 1", [slug]);
    if (existing.length > 0) {
      console.log(`${tag} skipped: slug already exists (${slug})`);
      continue;
    }

    try {
      console.log(`${tag} generating — focus: ${focus}`);
      const raw = await callMiniMax(target, focus);
      const { title, body, excerpt } = parseOutput(raw);
      if (!title || !body || body.length < 400) {
        console.warn(`${tag} output too short (${body?.length ?? 0} chars), skipping`);
        failed++;
        continue;
      }

      const id = crypto.randomUUID();
      await pool.execute(
        `insert into posts (id, title, slug, kind, excerpt, content, is_premium, is_published)
         values (?, ?, ?, 'analysis', ?, ?, ?, 1)`,
        [id, title, slug, excerpt, body, isPremium ? 1 : 0],
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
    await sleep(1200);
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
