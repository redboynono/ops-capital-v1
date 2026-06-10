/**
 * 财报深度文 prompt
 * --------------------------------------------------------------
 * 目标：1800-2500 字中文 markdown，机构级 buy-side 视角
 * 输出严格 JSON：{ title, slug, excerpt, content }
 *   - title 不超过 30 字，含 ticker / 季度
 *   - slug 形如 nvda-2026q1-earnings
 *   - excerpt 80-120 字，列表/卡片摘要
 *   - content 完整 markdown，含小标题、表格、要点
 */

export const EARNINGS_SYSTEM_PROMPT = `# Role
你是一名 buy-side 机构投资分析师，为中文付费投研平台 OPS Alpha 撰写美股财报深度解读。
读者是有专业基础的中国投资者，希望在 5 分钟内读懂"这家公司本季表现如何，下一步怎么操作"。

# 数据使用准则（**最高优先级，违反即为不合格**）
1. user prompt 里的 **Factsheet** 是本次唯一可信数据源（数字、估值、52W、margin 等）。
2. **Factsheet 与 news 都没列的数字 → 一律写"未披露"或"未公开数据"**，禁止用训练记忆里的数字伪装成本季实际。
3. 业务分部的同比 / 产品线增速 / 电话会原话：除非 news headline 明确出现，否则改写成"管理层在公开场合未具体披露 X 数据，业内一致预期为高个位数–中位数增长（仅供参考）"。
4. 目标价 / 止损位 / 加仓区间属于**主观建议**，必须明确标注 **"OPS 主观建议（非来自 factsheet）"**。
5. 任何带 "$" 或 "%" 的数字若不是 factsheet 直接给的，必须在该数字后加 *（推断）* 标记。

# 风格
- **数字驱动 + 可追溯**：每个论点的数字最好有 factsheet 依据
- **结构清晰**：小标题 + 要点列表 + 关键表格，不要长段废话
- **客观平衡**：业绩好也要写隐忧；不及预期也要写下季可能反弹点
- **可操作**：结尾给具体 entry / exit / risk 建议（明确标"主观建议"）
- 中文为主，关键术语保留英文（EPS / FCF / DCF / TAM / GAAP / non-GAAP / guide / beat / miss / consensus）

# 输出格式（极其严格）
仅输出一个 JSON 对象，不要任何 Markdown 包裹、不要 <think>、不要解释文字。
schema：
{
  "title": "字符串，<=30 字，含公司名/ticker + 季度",
  "slug": "字符串，全小写英文 + 数字 + 连字符，如 nvda-2026q1-earnings",
  "excerpt": "字符串，80-120 字，提炼本文最核心结论 + 操作方向",
  "content": "完整 markdown，1800-2500 字，结构见下"
}

# content 必须包含的小节（用 ## 标题）
1. **TL;DR** —— 三条要点 + 一句话结论 + 主观评分（A/B/C/D/F）
2. **业绩快览** —— 表格对比 actual / consensus / YoY，至少 EPS、营收、毛利率、营业利润率、运营现金流
3. **业务亮点** —— 2-3 条最关键的 segment / product / region 表现
4. **挑战与隐忧** —— 1-2 条值得警惕的趋势或一次性因素
5. **管理层指引** —— 引用电话会重点（如有 news 上下文），含下季 / 全年 guide
6. **估值反应** —— 当前 PE/PS/PEG vs 历史区间 + 同行；DCF 假设要点
7. **OPS 操作建议** —— 给具体方向：加仓 / 持有 / 减仓 / 观望，含触发位 / 止损 / 时间窗

# 表格语法
用标准 GFM markdown 表格。例：
| 指标 | 本季实际 | 市场预期 | YoY | 评价 |
|---|---|---|---|---|
| EPS | $0.85 | $0.81 | +12% | beat |

# 硬约束
- content 至少 1800 字
- 不要捏造电话会原话（如果 news 上下文里没有，写"管理层未在公开场合披露"）
- 不要使用 <think>...</think>
- 不要 markdown code fence 包裹整个 JSON
- excerpt 与 content 不可重复粘贴`;

export type EarningsPromptInputs = {
  symbol: string;
  name: string;
  sector: string | null;
  industry?: string | null;
  fiscal_year: number;
  fiscal_quarter: number;
  report_date: string;
  hour: string | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  // 上下文资料
  metrics?: Record<string, number | null> | null;
  news?: Array<{ headline: string; summary: string; source: string; url: string; datetime: number }>;
  ops_rating?: { verdict: string | null; score: number | null; target_price: number | null } | null;
};

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  return v.toFixed(digits);
}

function fmtRevenue(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function pickMetrics(m: Record<string, number | null> | null | undefined): string {
  if (!m) return "（无 financials 上下文）";
  const interest: Array<[string, string]> = [
    ["peNormalizedAnnual", "PE (TTM)"],
    ["pbAnnual", "PB"],
    ["psAnnual", "PS"],
    ["epsGrowth5Y", "EPS 5Y CAGR"],
    ["revenueGrowth5Y", "营收 5Y CAGR"],
    ["roe5Y", "5Y ROE"],
    ["grossMargin5Y", "5Y 毛利率"],
    ["operatingMargin5Y", "5Y 营业利润率"],
    ["currentRatioAnnual", "流动比率"],
    ["totalDebt/totalEquityAnnual", "Debt/Equity"],
    ["dividendYieldIndicatedAnnual", "股息率"],
    ["52WeekHigh", "52W 高"],
    ["52WeekLow", "52W 低"],
    ["beta", "Beta"],
    ["marketCapitalization", "市值（M USD）"],
  ];
  const lines: string[] = [];
  for (const [k, label] of interest) {
    const v = m[k];
    if (v == null || !Number.isFinite(v)) continue;
    lines.push(`- ${label}: ${typeof v === "number" ? v.toFixed(2) : v}`);
  }
  return lines.length > 0 ? lines.join("\n") : "（financials 全空）";
}

function pickNews(news: EarningsPromptInputs["news"]): string {
  if (!news || news.length === 0) return "（暂无 company-news 上下文）";
  return news
    .slice(0, 8)
    .map((n) => {
      const date = new Date(n.datetime * 1000).toISOString().slice(0, 10);
      return `- [${date}] ${n.headline}（${n.source}）\n  ${(n.summary || "").slice(0, 200)}`;
    })
    .join("\n");
}

/**
 * Build a structured plain-text factsheet that's the SINGLE SOURCE OF TRUTH
 * for both article generation and the post-generation fact-check.
 */
export function buildEarningsFactsheet(inputs: EarningsPromptInputs): string {
  const epsBeat = (() => {
    if (inputs.eps_actual == null || inputs.eps_estimate == null) return "n/a";
    const diff = inputs.eps_actual - inputs.eps_estimate;
    const pct = inputs.eps_estimate !== 0 ? (diff / Math.abs(inputs.eps_estimate)) * 100 : null;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}${pct !== null ? ` (${diff >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`;
  })();
  const revBeat = (() => {
    if (inputs.revenue_actual == null || inputs.revenue_estimate == null) return "n/a";
    const diff = inputs.revenue_actual - inputs.revenue_estimate;
    const pct = inputs.revenue_estimate !== 0 ? (diff / Math.abs(inputs.revenue_estimate)) * 100 : null;
    return `${diff >= 0 ? "+" : ""}${fmtRevenue(diff)}${pct !== null ? ` (${diff >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`;
  })();

  const lines: string[] = [
    "## 公司",
    `- symbol: ${inputs.symbol}`,
    `- name: ${inputs.name}`,
    `- industry: ${inputs.industry ?? inputs.sector ?? "n/a"}`,
    "",
    "## 本季财报（Finnhub /calendar/earnings）",
    `- fiscal_period: ${inputs.fiscal_year}Q${inputs.fiscal_quarter}`,
    `- report_date: ${inputs.report_date}`,
    `- hour: ${inputs.hour ?? "n/a"} (bmo=盘前 / amc=盘后 / dmh=盘中)`,
    `- eps_actual: ${fmtNum(inputs.eps_actual)}`,
    `- eps_estimate: ${fmtNum(inputs.eps_estimate)}`,
    `- eps_beat: ${epsBeat}`,
    `- revenue_actual: ${fmtRevenue(inputs.revenue_actual)}`,
    `- revenue_estimate: ${fmtRevenue(inputs.revenue_estimate)}`,
    `- revenue_beat: ${revBeat}`,
    "",
    "## 估值与财务（Finnhub /stock/metric basicFinancials）",
    pickMetrics(inputs.metrics),
    "",
    "## 近期 news headlines（Finnhub /company-news，过去 30 天）",
    pickNews(inputs.news),
  ];
  if (inputs.ops_rating && inputs.ops_rating.verdict) {
    lines.push(
      "",
      "## 现有 OPS 评级（来自 ticker_ratings 表）",
      `- ops_verdict: ${inputs.ops_rating.verdict}`,
      `- ops_score: ${fmtNum(inputs.ops_rating.score)}`,
      `- ops_target_price: $${fmtNum(inputs.ops_rating.target_price)}`,
    );
  }
  lines.push(
    "",
    "## 注意事项（factsheet 不包含 → 视为未披露）",
    "- 业务分部营收明细 / 同比增速（除非 news 提到）",
    "- 电话会原话",
    "- 下季 / 全年 management guidance",
    "- 同行 PE / PB 对比（factsheet 仅给本公司）",
  );
  return lines.join("\n");
}

export function buildEarningsUserPrompt(inputs: EarningsPromptInputs): string {
  const factsheet = buildEarningsFactsheet(inputs);
  return `# 任务
为 ${inputs.symbol} (${inputs.name}) 撰写 ${inputs.fiscal_year} 财年 Q${inputs.fiscal_quarter} 财报深度文。

# Factsheet（**唯一权威数据源；未列内容均视为"未披露"**）
${factsheet}

# 输出
严格按 system prompt 的 JSON schema 输出。content 至少 1800 字。slug 必须是 \`${inputs.symbol.toLowerCase()}-${inputs.fiscal_year}q${inputs.fiscal_quarter}-earnings\`。
**请逐字遵守 system prompt 中的"数据使用准则"，不要把训练记忆里的过期数据当成本季实际。**`;
}
