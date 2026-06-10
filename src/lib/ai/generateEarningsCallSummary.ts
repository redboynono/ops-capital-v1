/**
 * 业绩会要点摘要 — 基于财报 factsheet + 新闻标题（无逐字稿时的代理方案）。
 * 输出 Markdown 小节，追加到财报深度文末尾。
 */

import type { EarningsPromptInputs } from "@/lib/ai/earningsArticlePrompt";
import { buildEarningsFactsheet } from "@/lib/ai/earningsArticlePrompt";

const SYSTEM = `# Role
你是 OPS Alpha 投研终端的财报业绩会速记编辑。

# 任务
根据 Factsheet（EPS/营收 actual vs consensus、新闻标题）写 **业绩会要点** Markdown 小节（400-700 字）。
若无电话会逐字稿，只能根据新闻 headline 推断管理层可能强调的 themes，并明确标注「据公开新闻推断」。

# 结构（## 标题固定）
## 业绩会要点（AI 摘要）

### 业绩与指引
- 3-5 条 bullet，数字必须来自 factsheet

### Q&A 与多空焦点
- 2-4 条市场可能关心的追问方向（可标注推断）

### 管理层语气
- 1-2 句：偏积极 / 中性 / 谨慎

# 约束
- 禁止捏造未出现在 factsheet/news 的具体指引数字
- 不要 JSON，直接输出 Markdown
- 中文为主`;

export async function generateEarningsCallSummary(inputs: EarningsPromptInputs): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const factsheet = buildEarningsFactsheet(inputs);

  const beatMiss =
    inputs.eps_actual != null && inputs.eps_estimate != null
      ? inputs.eps_actual >= inputs.eps_estimate
        ? "EPS beat"
        : "EPS miss"
      : "EPS 待确认";

  const user = `# ${inputs.symbol} FY${inputs.fiscal_year} Q${inputs.fiscal_quarter} 业绩会摘要任务
财报日：${inputs.report_date} · ${beatMiss}

${factsheet}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) return "";
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j?.choices?.[0]?.message?.content ?? "";
  return String(raw)
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .trim();
}
