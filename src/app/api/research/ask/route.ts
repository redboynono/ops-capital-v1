import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { buildTickerFactsheet } from "@/lib/ai/factsheet";
import { getAIConfig, proxyChatCompletionStream } from "@/lib/ai/stream";
import { logEvent } from "@/lib/observability";
import { getPostBySlug } from "@/lib/posts";
import { listTickersForPost } from "@/lib/tickers";

type ChatMessage = { role: "user" | "assistant"; content: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AskPayloadKept = ChatMessage;

type AskPayload =
  | {
      kind: "ticker";
      symbol: string;
      question: string;
      history?: ChatMessage[];
    }
  | {
      kind: "post";
      slug: string;
      question: string;
      history?: ChatMessage[];
    };

const SYSTEM_PROMPT = `# Role
你是 OPS Alpha 投研终端的 AI 研究助手。你不是销售，不是顾问；是冷静、数据驱动的二级市场分析师。

# 数据使用准则（最高优先级）
1. 用户消息包含一段 **Factsheet**（实时报价 + 公司概况 + 估值/财务 + OPS 评级 + 近 14 天 news + 可能的文章原文），它是**唯一权威数据源**。
2. 涉及股价、市值、估值倍数、52W 高低、IPO 日期、CEO、近期事件 → 严格使用 factsheet 里的数字，禁止依赖训练记忆。
3. factsheet 没列的内容 → 写"未公开披露"或在数字后加 *（推断）* 标记。
4. 训练截止后发生的价格变动是常态（如 IPO 后涨跌 5×+），factsheet 里的价格才是真实当前价。
5. 严禁把同名旧标的（例如 2024 之前训练语料里的另一个 "CRCL"）误配成本标的。

# 输出风格
- 用中文回答（除非用户明确用英文问）
- 直接、点对点回答用户的问题，不要套话不要复述问题
- 篇幅与问题匹配（一句话能答的不要写五段）
- 涉及多个数字 / 事件时用 Markdown 列表
- **引用规范（必须）**：凡引用 factsheet 中的具体数字、评级、新闻标题，在该句末尾加脚注，格式为方括号包裹「来源: 类型 · 日期」，例如「来源: OPS Rating · 2026-05-19」
- 同一来源可重复标注；不要编造未在 factsheet 出现的来源名
- 不需要免责声明、不需要"投资有风险"那种话

# Guardrails
- 不给具体买入 / 卖出 / 加仓 / 减仓的指令；可以分析利弊，但留给用户决策
- 不保证收益、不预测精确价格点位
- 不引用 factsheet 之外的"内幕"或捏造数据`;

async function buildContextForTicker(symbol: string): Promise<string> {
  const factsheet = await buildTickerFactsheet(symbol);
  return `# 当前讨论的标的：${symbol.toUpperCase()}\n\n${factsheet}`;
}

async function buildContextForPost(slug: string): Promise<string | null> {
  const post = await getPostBySlug(slug);
  if (!post) return null;
  const tickers = await listTickersForPost(post.id);

  const parts: string[] = [];
  parts.push(`# 当前讨论的文章\n- 标题：${post.title}\n- 类型：${post.kind}\n- slug：${post.slug}`);
  parts.push("");
  parts.push("## 文章正文（节选）");
  parts.push(post.content.slice(0, 6000)); // 控制 prompt 长度

  if (tickers.length > 0) {
    parts.push("");
    parts.push(`# 文章关联的 ${tickers.length} 个标的实时 factsheet`);
    const sheets = await Promise.all(
      tickers.slice(0, 4).map((t) => buildTickerFactsheet(t.symbol)),
    );
    sheets.forEach((s, i) => {
      parts.push("");
      parts.push(`### [${i + 1}] ${tickers[i].symbol}`);
      parts.push(s);
    });
  }
  return parts.join("\n");
}

export async function POST(req: Request) {
  // 必须登录（控制成本）
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录后使用 AI 问答" }, { status: 401 });
  }

  let body: AskPayload;
  try {
    body = (await req.json()) as AskPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (question.length > 500)
    return NextResponse.json({ error: "问题过长（限 500 字）" }, { status: 400 });

  // 拉 factsheet
  let context: string | null = null;
  try {
    if (body.kind === "ticker") {
      const sym = (body.symbol ?? "").trim().toUpperCase();
      if (!sym) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
      context = await buildContextForTicker(sym);
    } else if (body.kind === "post") {
      const slug = (body.slug ?? "").trim();
      if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });
      context = await buildContextForPost(slug);
      if (!context) return NextResponse.json({ error: "post not found" }, { status: 404 });
    } else {
      return NextResponse.json({ error: "invalid context kind" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: "factsheet build failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }

  const ai = getAIConfig();
  if (!ai) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  // 埋点：记录每次 AI 问询，便于按用户 / 标的 / 时段统计
  logEvent("ai_query", {
    userId: user.id,
    symbol: body.kind === "ticker" ? body.symbol : null,
    meta: {
      kind: body.kind,
      qLen: question.length,
      contextLen: context?.length ?? 0,
      slug: body.kind === "post" ? body.slug : undefined,
    },
  });

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  return proxyChatCompletionStream({
    apiKey: ai.apiKey,
    baseUrl: ai.baseUrl,
    model: ai.model,
    temperature: 0.3,
    maxTokens: Number(process.env.OPENAI_QA_MAX_TOKENS ?? 12000),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `# Factsheet\n${context}\n\n----\n\n# 用户问题\n${question}`,
      },
      ...history,
    ],
  });
}
