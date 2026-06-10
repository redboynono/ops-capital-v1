#!/usr/bin/env node
/**
 * Seed initial OPS Alpha content by calling MiniMax and inserting into MySQL.
 *
 * Run inside the ops-alpha container (env already set):
 *   docker cp scripts/seed-content.mjs ops-alpha:/tmp/seed-content.mjs
 *   docker exec -i ops-alpha node /tmp/seed-content.mjs
 *
 * Idempotent: skips if slug already exists.
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";

// --------------------------- config --------------------------- //

const MYSQL_URL = process.env.MYSQL_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "MiniMax-M2.7-highspeed";
const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 16000);

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

// --------------------------- prompts --------------------------- //

const researchSystemPrompt = `# Role: 华尔街顶级对冲基金首席投资官 (CIO) & 资深宏观科技分析师

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

const newsSystemPrompt = `# Role: 资深财经快讯编辑（中文）
## Objective: 基于给定事件/标的，生成一条简洁的市场快讯。
## Output:
- 首行为 "# 标题"（<= 28 字，包含标的或事件核心，不要加任何前缀）
- 正文 1-3 段 Markdown，共 200-380 字
- 末尾列出 "**关键数据**" bullet（若无则省略）
- 避免投资建议，避免夸张情绪化词汇
- 若缺少事实信息，用"据报道/市场传闻"等表述`;

// --------------------------- tasks --------------------------- //

/** @type {{kind:"analysis"|"news", target:string, focus:string, tickers:string[], premium:boolean}[]} */
const TASKS = [
  // ========== ANALYSIS (8) ==========
  { kind: "analysis", target: "NVDA 英伟达",     focus: "AI GPU 霸主地位、Blackwell 平台量产节奏与数据中心业务的长期定价权", tickers: ["NVDA"], premium: false },
  { kind: "analysis", target: "TSLA 特斯拉",     focus: "Robotaxi 与 Optimus 机器人商业化对估值框架的重构", tickers: ["TSLA"], premium: true },
  { kind: "analysis", target: "00700 腾讯控股",  focus: "游戏 AI 化、视频号商业化、金融科技业务三线共振的估值修复", tickers: ["00700", "TCEHY"], premium: false },
  { kind: "analysis", target: "09988 阿里巴巴",  focus: "阿里云重启增长、淘天电商用户回流、菜鸟 IPO 重启", tickers: ["09988", "BABA"], premium: true },
  { kind: "analysis", target: "TSM 台积电",      focus: "2nm 良率、CoWoS 先进封装瓶颈、AI 芯片定价权", tickers: ["TSM"], premium: true },
  { kind: "analysis", target: "BTC 比特币",      focus: "现货 ETF 后时代的机构化、减半周期与美联储利率路径", tickers: ["BTC"], premium: true },
  { kind: "analysis", target: "AMD 超威",        focus: "MI325X/MI355X 进度、在 AI 推理市场抢占 NVDA 市占的窗口", tickers: ["AMD"], premium: true },
  { kind: "analysis", target: "META Platforms", focus: "Reality Labs 减亏节奏、广告业务 AI 推荐引擎、Llama 4 开源战略", tickers: ["META"], premium: true },

  // ========== NEWS (18) ==========
  { kind: "news", target: "NVDA 英伟达",  focus: "数据中心业务收入占比超 80%，Blackwell 交付加速", tickers: ["NVDA"], premium: false },
  { kind: "news", target: "TSLA 特斯拉",  focus: "季度交付略低于市场预期，Cybertruck 产能爬坡受阻", tickers: ["TSLA"], premium: false },
  { kind: "news", target: "AAPL 苹果",    focus: "iPhone 17 AI 升级预期升温，供应链提前备货", tickers: ["AAPL"], premium: false },
  { kind: "news", target: "MSFT 微软",    focus: "Azure AI 业务同比增长 50%+，Copilot 企业订阅加速", tickers: ["MSFT"], premium: false },
  { kind: "news", target: "GOOGL 谷歌",   focus: "Gemini 3 Pro 发布，开源权重策略引发资本市场关注", tickers: ["GOOGL"], premium: false },
  { kind: "news", target: "META",         focus: "Reality Labs 亏损同比收窄，Ray-Ban Meta 销量创纪录", tickers: ["META"], premium: false },
  { kind: "news", target: "AMZN 亚马逊",  focus: "AWS 重返两位数增长，Nova 系列模型商用落地", tickers: ["AMZN"], premium: false },
  { kind: "news", target: "AMD 超威",     focus: "MI325X 出货加速，企业客户订单能见度延伸至 2027", tickers: ["AMD"], premium: false },
  { kind: "news", target: "TSM 台积电",   focus: "2nm 产能利用率超 90%，ASP 同比提升 20%", tickers: ["TSM"], premium: false },
  { kind: "news", target: "AVGO 博通",    focus: "VMware 并购协同加速，网络芯片业务营收超预期", tickers: ["AVGO"], premium: false },
  { kind: "news", target: "BTC 比特币",   focus: "突破 7 万美元关口，现货 ETF 单周净流入近 20 亿美元", tickers: ["BTC"], premium: false },
  { kind: "news", target: "ETH Ethereum", focus: "Ethereum ETF 资金流入转正，Layer 2 TVL 创新高", tickers: ["ETH"], premium: false },
  { kind: "news", target: "SOL Solana",   focus: "Solana 生态 DeFi TVL 创年内新高，Meme 交易量占据主导", tickers: ["SOL"], premium: false },
  { kind: "news", target: "BABA 阿里巴巴", focus: "云业务毛利率改善至 18%，淘天 GMV 同比转正", tickers: ["BABA", "09988"], premium: false },
  { kind: "news", target: "PDD 拼多多",   focus: "Temu 美国市场单日包裹量再创新高，Q3 业绩指引上修", tickers: ["PDD"], premium: false },
  { kind: "news", target: "00700 腾讯控股", focus: "微信搜一搜接入元宝大模型，商业化路径初现", tickers: ["00700", "TCEHY"], premium: false },
  { kind: "news", target: "NIO 蔚来",     focus: "乐道 L60 10 月交付同比翻倍，毛利率改善预期升温", tickers: ["NIO"], premium: false },
  { kind: "news", target: "03690 美团",   focus: "即时零售业务单量同比增长 35%，Keeta 香港市占稳固", tickers: ["03690"], premium: false },
];

// --------------------------- helpers --------------------------- //

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(kind, tickers) {
  const sym = (tickers[0] ?? "general").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(2).toString("hex");
  return `${kind}-${sym}-${ts}-${rand}`;
}

function parseOutput(raw) {
  // strip <think>
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
  // extract title: first "# ..." line
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
    // fallback: use first non-empty line
    title = (lines.find((l) => l.trim()) ?? "(untitled)").replace(/^#+\s*/, "").slice(0, 40);
    bodyStart = 1;
  }
  const body = lines.slice(bodyStart).join("\n").trim();
  // excerpt: first non-empty paragraph, trimmed to ~140 chars
  const firstPara = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith("#")) ?? "";
  const excerpt = firstPara
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return { title, body: cleaned, excerpt };
}

async function callMiniMax(kind, target, focus, attempt = 1) {
  const systemPrompt = kind === "news" ? newsSystemPrompt : researchSystemPrompt;
  const userPrompt =
    kind === "news"
      ? `请基于以下主题生成一条市场快讯（中文）：\n主题：${target}\n补充信息：${focus}\n首行为 # 标题。`
      : `请分析以下标的并输出机构级 Markdown 研报：\n标的：${target}\n用户关注点：${focus}\n首行为 # 标题。文章 1500-2500 字。`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
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
      console.warn(`  [529 overloaded] retry ${attempt}/2 in 8s...`);
      await sleep(8000);
      return callMiniMax(kind, target, focus, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    const msg = data.base_resp.status_msg ?? "unknown";
    if (data.base_resp.status_code === 2064 && attempt < 3) {
      console.warn(`  [overloaded:2064] retry ${attempt}/2 in 10s...`);
      await sleep(10000);
      return callMiniMax(kind, target, focus, attempt + 1);
    }
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${msg}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty content");
  return content;
}

// --------------------------- main --------------------------- //

async function main() {
  console.log(`> connecting to MySQL...`);
  const pool = mysql.createPool(MYSQL_URL);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    const tag = `[${i + 1}/${TASKS.length}] ${t.kind.toUpperCase()} ${t.target}`;
    try {
      console.log(`${tag} generating...`);
      const raw = await callMiniMax(t.kind, t.target, t.focus);
      const { title, body, excerpt } = parseOutput(raw);
      if (!title || !body) {
        console.warn(`${tag} skipped: empty title/body`);
        failed++;
        continue;
      }

      const id = crypto.randomUUID();
      const slug = slugify(t.kind, t.tickers);
      await pool.execute(
        `insert into posts (id, title, slug, kind, excerpt, content, is_premium, is_published)
         values (?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, title, slug, t.kind, excerpt, body, t.premium ? 1 : 0],
      );
      for (const sym of t.tickers) {
        await pool.execute(
          `insert ignore into post_tickers (post_id, symbol) values (?, ?)`,
          [id, sym],
        );
      }
      inserted++;
      console.log(`${tag} ✓ "${title}" (${body.length} chars)  slug=${slug}`);
    } catch (err) {
      failed++;
      console.error(`${tag} ✗ ${err.message}`);
    }
    // small gap to be nice to the API
    await sleep(800);
  }

  await pool.end();
  console.log(`\n===== done =====`);
  console.log(`inserted: ${inserted}`);
  console.log(`skipped:  ${skipped}`);
  console.log(`failed:   ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
