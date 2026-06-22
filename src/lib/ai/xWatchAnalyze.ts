import { AI_VALUE_CHAIN_LAYERS } from "@/lib/marketing/ai-value-chain";
import { callModel, extractJson, parseModelJsonField } from "@/lib/ai/_runtime";

export type XWatchTopicType =
  | "framework"
  | "watchlist"
  | "conviction"
  | "rotation"
  | "cheatsheet"
  | "other";

export type XWatchAnalysis = {
  topic_type: XWatchTopicType;
  tickers: string[];
  summary_md: string;
  ops_angle_md: string;
  reply_draft: string;
};

const LAYER_BRIEF = AI_VALUE_CHAIN_LAYERS.map(
  (l) => `${l.id} ${l.nameEn}: ${l.roleEn}`,
).join("\n");

const SYSTEM = `You are an AI supply-chain analyst for OPS Capital (opscapital.com).
OPS uses an L0–L5 AI value-chain framework and "chokepoint" thesis (structural bottlenecks hyperscalers must flow through).

Value chain layers:
${LAYER_BRIEF}

You help an admin understand posts from Serenity (@aleabitoreddit) — Neocloud, macro buckets, conviction lists, chokepoints.
Output strict JSON only. Reply drafts must be English, concise, thoughtful, ≤280 characters, not sycophantic.
Never give investment advice; use "NFA / DYODD" tone. Add one differentiated OPS angle (upstream chokepoint or L-layer mapping) when possible.`;

export async function analyzeXWatchTweet(input: {
  username: string;
  tweetText: string;
  tweetUrl: string;
  postedAt: string;
}): Promise<XWatchAnalysis> {
  const userPrompt = `Analyze this X post from @${input.username}.

URL: ${input.tweetUrl}
Posted: ${input.postedAt}

---
${input.tweetText}
---

Return JSON:
{
  "topic_type": "framework|watchlist|conviction|rotation|cheatsheet|other",
  "tickers": ["SYM", ...],
  "summary_md": "3-5 bullet points in Chinese for admin (use \\n- prefix)",
  "ops_angle_md": "2-3 sentences in Chinese: map to L0-L5 / chokepoint, what's the incremental insight vs just agreeing",
  "reply_draft": "English reply ≤280 chars, 1-2 sentences agree/reframe + optional sharp question"
}`;

  const raw = await callModel(SYSTEM, userPrompt, {
    temperature: 0.35,
    maxTokens: 8192,
    jsonMode: true,
  });
  const j = extractJson(raw);

  const topic = String(j.topic_type ?? "other");
  const validTopics: XWatchTopicType[] = [
    "framework",
    "watchlist",
    "conviction",
    "rotation",
    "cheatsheet",
    "other",
  ];
  const topic_type = validTopics.includes(topic as XWatchTopicType)
    ? (topic as XWatchTopicType)
    : "other";

  const tickers = Array.isArray(j.tickers)
    ? j.tickers.map((t) => String(t).replace(/^\$/, "").toUpperCase()).filter(Boolean).slice(0, 24)
    : [];

  let reply_draft = String(j.reply_draft ?? "").trim();
  if (reply_draft.length > 280) reply_draft = reply_draft.slice(0, 277) + "…";

  return {
    topic_type,
    tickers,
    summary_md: String(j.summary_md ?? "").trim(),
    ops_angle_md: String(j.ops_angle_md ?? "").trim(),
    reply_draft,
  };
}

const REPLY_SYSTEM = `You draft English replies for OPS Capital (@opscapital) responding to Serenity (@aleabitoreddit) on X.

Voice: sharp, collegial, not sycophantic. NFA / DYODD — never investment advice.
Length: ≤280 characters (hard limit).

If the post is markets / AI / supply chain:
- Add one differentiated OPS angle (L0–L5 value chain or upstream chokepoint) when natural.
- Can agree, reframe, or ask one sharp question.

If the post is off-topic (sports, personal, macro non-markets):
- Reply lightly and intelligently; do NOT force finance jargon or chokepoint framing.
- Stay witty/professional; optional tie-in to markets only if it fits organically.

Output strict JSON: { "reply_draft": "...", "reply_draft_zh": "中文对照（帮助 admin 理解英文草稿，自然中文）" }`;

export type XWatchReplyDraft = {
  reply_draft: string;
  reply_draft_zh: string;
};

export async function generateXWatchReply(input: {
  username: string;
  tweetText: string;
  tweetUrl: string;
  topicType?: string | null;
  summaryMd?: string | null;
  opsAngleMd?: string | null;
  currentDraft?: string | null;
}): Promise<XWatchReplyDraft> {
  const context: string[] = [];
  if (input.topicType) context.push(`Topic type: ${input.topicType}`);
  if (input.summaryMd) context.push(`Admin summary (ZH):\n${input.summaryMd}`);
  if (input.opsAngleMd) context.push(`OPS angle (ZH):\n${input.opsAngleMd}`);
  if (input.currentDraft?.trim()) {
    context.push(`Current draft (rewrite/improve, don't copy verbatim unless good):\n${input.currentDraft.trim()}`);
  }

  const userPrompt = `Draft a reply to this X post from @${input.username}.

URL: ${input.tweetUrl}

---
${input.tweetText}
---
${context.length > 0 ? `\nContext:\n${context.join("\n\n")}\n` : ""}
Return JSON: { "reply_draft": "English reply ≤280 chars", "reply_draft_zh": "中文对照" }`;

  const raw = await callModel(REPLY_SYSTEM, userPrompt, {
    temperature: 0.45,
    maxTokens: 8192,
    jsonMode: true,
  });
  let reply_draft: string;
  let reply_draft_zh: string;
  try {
    reply_draft = parseModelJsonField(raw, "reply_draft");
    reply_draft_zh = parseModelJsonField(raw, "reply_draft_zh");
  } catch {
    const j = extractJson(raw);
    reply_draft = String(j.reply_draft ?? "").trim();
    reply_draft_zh = String(j.reply_draft_zh ?? "").trim();
  }
  if (!reply_draft) throw new Error("empty reply from model");
  if (reply_draft.length > 280) reply_draft = reply_draft.slice(0, 277) + "…";
  if (!reply_draft_zh) reply_draft_zh = await translateXWatchReplyZh(reply_draft);
  return { reply_draft, reply_draft_zh };
}

export async function translateXWatchReplyZh(english: string): Promise<string> {
  const text = english.trim();
  if (!text) return "";
  const raw = await callModel(
    "Translate the English X reply draft to natural Chinese for admin review. Output JSON: { \"reply_draft_zh\": \"...\" }",
    `English draft:\n${text}`,
    { temperature: 0.2, maxTokens: 2048, jsonMode: true },
  );
  try {
    return parseModelJsonField(raw, "reply_draft_zh");
  } catch {
    return String(extractJson(raw).reply_draft_zh ?? "").trim();
  }
}
