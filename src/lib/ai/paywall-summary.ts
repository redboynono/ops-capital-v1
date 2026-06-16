/**
 * 付费墙「AI 一句话结论」——免费展示的钩子，用来提升解锁转化率。
 *
 * 规则：
 *  - 单句、口语化的「立场 + 最关键变量」，绝不泄露被锁字段（目标价/止损/仓位）。
 *  - 按 post_id + lang 缓存；正文 hash 变化才重算，避免每次浏览都调用 LLM。
 *  - AI 未配置或失败时返回 null，调用方应优雅地不渲染该模块。
 */

import crypto from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import { collectChatCompletion, getAIConfig } from "@/lib/ai/stream";

const MAX_LEN = 140;

export function bodyHash(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex");
}

// 推理模型偶尔把"思考过程"（字数计算、Wait/Adjust、let me…）直接写进 content，需识别并丢弃
const REASONING_RE =
  /\b(chars?|words?|count|too long|wait,|adjust|let me|i need to|i should|first,|字数|个字|重新|应该|调整)\b|=\s*\d/i;

function looksLikeReasoning(line: string): boolean {
  return REASONING_RE.test(line);
}

function sanitize(raw: string): string {
  // 1) 去掉 <think>…</think> 整块
  const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, " ").replace(/<\/?think>/gi, " ");
  // 2) 按行拆，最终答案通常在最后；自后向前取第一条"不像推理、且够长"的行
  const lines = noThink
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let pick = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].length >= 8 && !looksLikeReasoning(lines[i])) {
      pick = lines[i];
      break;
    }
  }
  if (!pick) pick = lines[lines.length - 1] ?? noThink;

  let s = pick
    .replace(/[#*_`>]/g, " ")
    .replace(/^\s*(AI\s*速读|AI\s*Take)\s*[:：]\s*/i, "")
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > MAX_LEN) {
    const truncated = s.slice(0, MAX_LEN);
    // 1) 优先在句末标点收尾
    const lastStop = Math.max(
      truncated.lastIndexOf("。"),
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("！"),
      truncated.lastIndexOf("!"),
    );
    if (lastStop > MAX_LEN * 0.6) {
      s = truncated.slice(0, lastStop + 1);
    } else {
      // 2) 退而在词边界（空格）截断，避免把英文单词切一半
      const lastSpace = truncated.lastIndexOf(" ");
      const cut = lastSpace > MAX_LEN * 0.6 ? truncated.slice(0, lastSpace) : truncated;
      s = cut.trim() + "…";
    }
  }
  return s;
}

function buildPrompt(title: string, body: string, en: boolean) {
  const system = en
    ? `You write a single punchy teaser line for a paywalled equity research note. Goal: make the reader want to unlock the full report.
RULES:
- Output ONLY the final sentence — no preamble, no reasoning, no word/character counting, no "Wait/Adjust", no quotes, no markdown.
- ONE sentence, max 25 words.
- State the stance (bullish / bearish / neutral) and the SINGLE most important driver or catalyst.
- NEVER reveal numbers behind the paywall: no price target, stop-loss, position size, or exact upside %.
- Tone: confident analyst, slightly teasing curiosity. No disclaimer.
Respond with the sentence and nothing else.`
    : `你为一篇付费研报写一句"AI 速读"钩子，目的是让读者想解锁全文。
规则：
- 只输出最终那一句话——不要任何思考过程、不要数字数、不要"等一下/调整"之类的话、不要引号、不要 markdown。
- 一句话，不超过 40 个汉字。
- 点明立场（看多/看空/中性）+ 最关键的那个变量或催化剂。
- 绝不泄露付费墙后的具体数字：不写目标价、不写止损、不写仓位、不写精确涨幅%。
- 语气：冷静而自信的分析师，留一点悬念。不要免责声明。
直接输出这一句话，不要输出别的任何内容。`;
  const user = en
    ? `Title: ${title}\n\nReport body (for your understanding only, do not quote locked numbers):\n${body.slice(0, 6000)}`
    : `标题：${title}\n\n研报正文（仅供你理解，不要照搬被锁数字）：\n${body.slice(0, 6000)}`;
  return { system, user };
}

async function readCache(postId: string, lang: string, hash: string): Promise<string | null> {
  try {
    const rows = await mysqlQuery<{ summary: string; body_hash: string }[]>(
      `select summary, body_hash from post_ai_summaries where post_id = ? and lang = ? limit 1`,
      [postId, lang],
    );
    const row = rows[0];
    if (row && row.body_hash === hash) return row.summary;
    return null;
  } catch {
    return null; // 表未迁移
  }
}

async function writeCache(
  postId: string,
  lang: string,
  hash: string,
  summary: string,
  model: string,
): Promise<void> {
  try {
    await mysqlQuery(
      `insert into post_ai_summaries (post_id, lang, body_hash, summary, model)
       values (?, ?, ?, ?, ?)
       on duplicate key update body_hash = values(body_hash), summary = values(summary),
                               model = values(model), updated_at = current_timestamp`,
      [postId, lang, hash, summary, model],
    );
  } catch (err) {
    console.warn("[paywall-summary] cache write failed:", (err as Error).message);
  }
}

/**
 * 取（或按需生成并缓存）付费墙 AI 一句话结论。失败/未配置返回 null。
 */
export async function getOrCreatePaywallSummary(opts: {
  postId: string;
  lang: "zh" | "en";
  title: string;
  body: string;
}): Promise<string | null> {
  const { postId, lang, title, body } = opts;
  if (!body || body.trim().length < 200) return null; // 正文太短不值得

  const hash = bodyHash(body);
  const cached = await readCache(postId, lang, hash);
  if (cached) return cached;

  const ai = getAIConfig();
  if (!ai) return null;

  const { system, user } = buildPrompt(title, body, lang === "en");
  let out: string;
  try {
    out = await collectChatCompletion({
      apiKey: ai.apiKey,
      baseUrl: ai.baseUrl,
      model: ai.model,
      temperature: 0.4,
      // 推理模型的 <think> 会占用 token 预算，预留充足空间，避免最终答案被截断
      maxTokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } catch (err) {
    console.warn("[paywall-summary] LLM failed:", (err as Error).message);
    return null;
  }

  const summary = sanitize(out);
  // 长度不足，或仍残留推理痕迹 → 视为失败，不缓存（下次访问会重试）
  if (!summary || summary.length < 8 || looksLikeReasoning(summary)) {
    console.warn(`[paywall-summary] rejected output for ${postId}/${lang}: ${summary.slice(0, 80)}`);
    return null;
  }

  await writeCache(postId, lang, hash, summary, ai.model);
  return summary;
}
