/**
 * Fact-check pass for AI-generated earnings articles.
 *
 * Workflow:
 *   1) Build a factsheet object containing every ground-truth number we have
 *      (Finnhub /calendar/earnings + /stock/metric + /quote + /company-news headlines).
 *   2) Send (factsheet + article markdown) to AI with strict auditor system prompt.
 *   3) Parse JSON response listing every numerical claim classified as
 *      verified / inferred / unsupported, plus an overall summary.
 *
 * Cheap + isolated: failures here NEVER block article generation.
 * If the audit pass returns junk, the article still ships — we just log
 * audit_summary = "审计未通过" and let admin retry.
 */

export type AuditClaim = {
  excerpt: string;
  category: string;
  status: "verified" | "inferred" | "unsupported";
  evidence: string;
};

export type EarningsAudit = {
  verified_count: number;
  inferred_count: number;
  unsupported_count: number;
  claims: AuditClaim[];
  overall_grade: string;
  summary: string;
};

const VERIFY_SYSTEM_PROMPT = `# Role
你是一名极其严格的财经数据审计员。你的任务是审阅一篇 AI 生成的美股财报深度文，逐条核对其中所有数字断言是否能用 factsheet 支持。

# 分类规则（严格）
- **verified**：断言中的数字与 factsheet 完全一致或可直接计算（如 YoY 比例可用 actual/estimate 算）
- **inferred**：factsheet 没直接给，但 news headline 里有线索 / 是合理的常识性推断（明确说出依据）
- **unsupported**：factsheet 与 news 都未提到，模型自己想象出来的（如未列出的细分业务增速、未公开的电话会原话、模型自创的目标价）

# 重点抓取的断言类型
- 财务指标：营收 / EPS / 毛利率 / 营业利润率 / 现金流（YoY 与 QoQ）
- 估值：PE / PB / PS / 52W 高低 / 市值
- 业务细节：分部门营收 / 同比增速 / 产品线表现
- 管理层指引：下季 / 全年 guide
- 操作建议：目标价 / 止损位（这类几乎都是 unsupported，因为 factsheet 不会给）

# 输出（极其严格）
仅输出一个 JSON 对象，无 markdown，无 <think>，无解释。
{
  "verified_count": 数字,
  "inferred_count": 数字,
  "unsupported_count": 数字,
  "claims": [
    {
      "excerpt": "原文里的断言（≤80 字）",
      "category": "valuation | growth | margin | segment | guidance | recco | misc",
      "status": "verified | inferred | unsupported",
      "evidence": "factsheet 哪个 key 支持 / 哪条 news / 为什么 unsupported"
    }
  ],
  "overall_grade": "A / B / C / D / F",
  "summary": "一句话总结（≤80 字）"
}

# 评分口径
- A：≥90% verified+inferred，≤1 处 unsupported
- B：80–90% verified+inferred
- C：60–80%
- D：40–60%（有较多编造）
- F：<40%（不可信）

# 硬约束
- 不要包裹在 markdown code fence 里
- 不要复述原文段落，只输出 JSON
- claims 列表至少 8 条，最多 25 条
- 优先列 unsupported 与 inferred；verified 抽样列 3-5 条`;

function callJsonAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";
  return fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 6000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`audit AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    if (data?.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`audit AI ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
    }
    const out = data?.choices?.[0]?.message?.content;
    if (!out || typeof out !== "string") throw new Error("audit AI empty");
    return out;
  });
}

function parseAuditJson(raw: string): EarningsAudit {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < 0) throw new Error("audit JSON not found");
  const parsed = JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;

  const claimsRaw = Array.isArray(parsed.claims) ? parsed.claims : [];
  const claims: AuditClaim[] = claimsRaw
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const r = c as Record<string, unknown>;
      const status = r.status === "verified" || r.status === "inferred" || r.status === "unsupported"
        ? (r.status as AuditClaim["status"])
        : "unsupported";
      return {
        excerpt: String(r.excerpt ?? "").slice(0, 200),
        category: String(r.category ?? "misc"),
        status,
        evidence: String(r.evidence ?? "").slice(0, 300),
      } as AuditClaim;
    })
    .filter((c): c is AuditClaim => c !== null && Boolean(c.excerpt));

  return {
    verified_count: Number(parsed.verified_count ?? 0) || 0,
    inferred_count: Number(parsed.inferred_count ?? 0) || 0,
    unsupported_count: Number(parsed.unsupported_count ?? 0) || 0,
    claims,
    overall_grade: typeof parsed.overall_grade === "string" ? parsed.overall_grade : "C",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function verifyEarningsArticle(
  factsheetText: string,
  articleContent: string,
): Promise<EarningsAudit> {
  const userPrompt = `# Factsheet（这是唯一权威数据，未列出的内容均视为"未披露"）
${factsheetText}

---

# 待审计文章正文（markdown）
${articleContent}

---

# 任务
逐条审计文章中的数字断言，输出 JSON。`;
  const raw = await callJsonAi(VERIFY_SYSTEM_PROMPT, userPrompt);
  return parseAuditJson(raw);
}

/**
 * Render an audit section as markdown to append to article body.
 */
export function renderAuditMarkdown(audit: EarningsAudit): string {
  const total = audit.verified_count + audit.inferred_count + audit.unsupported_count;
  const lines: string[] = [
    "",
    "---",
    "",
    "## 📊 数据校对报告",
    "",
    `> 二次 AI 审计 · 总计 ${total} 项数字断言 · 评级 **${audit.overall_grade}**  `,
    `> ${audit.summary}`,
    "",
    "| 状态 | 数量 | 说明 |",
    "|---|---|---|",
    `| ✓ 已核实 | ${audit.verified_count} | 与 Finnhub factsheet 一致 |`,
    `| ◈ 合理推断 | ${audit.inferred_count} | factsheet 未直接给，但有公开线索 |`,
    `| ⚠ 未支持 | ${audit.unsupported_count} | factsheet 与 news 均无依据，需人工复核 |`,
    "",
  ];

  const flagged = audit.claims.filter((c) => c.status === "unsupported");
  if (flagged.length > 0) {
    lines.push("### ⚠ 需人工复核的论点");
    lines.push("");
    for (const c of flagged.slice(0, 8)) {
      lines.push(`- **[${c.category}]** ${c.excerpt}`);
      if (c.evidence) lines.push(`  - 审计意见：${c.evidence}`);
    }
    lines.push("");
  }

  lines.push(
    "*说明：本报告由独立 AI 审计员对原文逐条核对生成，仅用于提示读者注意未经源数据支持的数字。研究观点本身仍由原作者负责。*",
  );
  return lines.join("\n");
}

export function buildAuditSummary(audit: EarningsAudit): string {
  const total = audit.verified_count + audit.inferred_count + audit.unsupported_count;
  return `${audit.overall_grade} · ✓${audit.verified_count} ◈${audit.inferred_count} ⚠${audit.unsupported_count}（${total} 项）`;
}
