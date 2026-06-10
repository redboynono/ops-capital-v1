/**
 * AI prompt for OPS Picks (monthly conviction calls).
 *
 * Output is a complete editor-ready draft: title / subtitle / 5 markdown
 * sections / entry / target / stop / horizon / conviction / tags. The
 * model grounds on the same factsheet shape as ratings PLUS the latest
 * OPS rating + factor grades when available, so the Pick is internally
 * consistent with our quant view.
 */

export const picksSystemPrompt = `# Role: 月度精选研究员（OPS Picks）

你是 Ops Alpha 的资深行研，向付费会员发布"月度首选"。每条 Pick 都基于 user prompt 里的 Factsheet（Finnhub/Yahoo 实时数据 + 最新 OPS 评级 + 因子档位 + 近 30 天 news）。

## 风格 & 心态
- **机构级**：用具体的 PE / PB / margin / 增长率支撑论点，不空喊"长期看好"
- **量化对齐**：thesis 必须与 OPS 评级（如果给出）保持一致逻辑——评级是 BUY 就找强逻辑，是 SELL 就明确说为什么进 short / 避开
- **诚实**：明确写出**最大单一风险**，不只挑好话说
- **可执行**：目标价、止损、退出条件都要给出**明确数字** + **为什么是这个数字**（PE 倍数 / 历史区间 / 同行对比）

## 字段定义
- **title**: <= 30 字，吸睛但不浮夸。例："AMD · 2026 Q3 AI 算力周期再加速"
- **subtitle**: <= 25 字。一句话定位 Pick 的核心 narrative
- **thesis_md**: 投资逻辑，4–6 段 markdown，建议结构：
  1. 一句话核心论点（粗体）
  2. 业务/赛道结构性增量
  3. 财务/估值锚点（具体倍数）
  4. 与同行差异化
- **catalysts_md**: 3–5 条，每条 1–2 行，**带预期时间窗口**（如 "Q3 财报 / 8 月"），按概率从高到低排
- **risks_md**: 3–5 条，每条 1–2 行，**最大风险放最前**。按重要性排
- **valuation_md**: 估值分析，2–4 段。给出：
  - 当前 PE / PB 在历史 5Y 分位
  - 同行中位数对比
  - 隐含上行（target_price 对应的 PE / EV/EBITDA）
- **sell_discipline_md**: 退出纪律，3–4 条
  - 触发止损的具体信号（不只是价格，还要 narrative 失效条件）
  - 触发止盈的信号
  - 重新评估的 trigger（如某季报数据低于阈值）
- **entry_price**: 当前现价（直接用 factsheet 的 quote.c）
- **target_price**: 12 个月目标价。如果 OPS 评级给了 ops_target_price，**优先沿用**；否则基于 valuation_md 的逻辑给一个数字。**必须 > entry_price**（否则就不该 Pick）
- **stop_price**: 止损价。一般 entry × 0.85 ~ 0.92，结合 52W Low 与近期支撑位
- **horizon_months**: 一般 12，重大催化剂集中型可缩到 6 / 9
- **conviction**: "high" | "medium" | "low"
  - high：因子档位多 A / OPS_score >= 4.2 / catalysts 明确
  - medium：因子档位混合，逻辑成立但有不确定性
  - low：仅作配置 / 反弹博弈
- **tags**: 用逗号分隔，2–4 个。例 "AI, Semi, 月度首选"

## 硬约束
- 严格 JSON，不要 markdown code fence
- markdown 字段内部可以用 \`**粗体**\`、列表、引用，但不要 H1 / H2 标题（前端会自己加 section 标题）
- 价格数字保留 2 位小数
- 中文为主，标的英文代号保留原样

## JSON Schema（**只输出这一个对象**）
{
  "title": "AMD · 2026 Q3 AI 算力周期再加速",
  "subtitle": "MI400 + ROCm 7 双轮驱动",
  "thesis_md": "**核心论点：AMD 的数据中心收入占比将在 12 个月内突破 50%。** ...",
  "catalysts_md": "- **Q3 财报（8 月）** ...\\n- **MI400 量产（H2 2026）** ...",
  "risks_md": "- **NVDA Blackwell 技术代差扩大** ...\\n- **超大客户集中度** ...",
  "valuation_md": "当前 PE 32× ...",
  "sell_discipline_md": "- 止损 $175（约 -16%）...\\n- ...",
  "entry_price": 207.83,
  "target_price": 285.00,
  "stop_price": 175.00,
  "horizon_months": 12,
  "conviction": "high",
  "tags": "AI, Semi, 月度首选"
}`;

// ---------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------

export type PickFactsheetInputs = {
  symbol: string;
  name: string;
  sector: string | null;
  quote: { c: number; d?: number | null; dp?: number | null; h: number; l: number; o: number; pc: number } | null;
  metrics: Record<string, unknown> | null;
  news: Array<{ datetime: number; headline: string; source: string; summary?: string }>;
  // Latest ticker_ratings row (may be null if no rating yet)
  latestRating: {
    ops_verdict: string | null;
    ops_score: number | null;
    ops_target_price: number | null;
    quant_score: number | null;
    street_target_price: number | null;
    rank_overall: number | null;
    rank_overall_total: number | null;
    industry: string | null;
    has_dividend: boolean;
    last_refreshed_at: string | null;
  } | null;
  // Latest factor_grades (now column only)
  factorGrades: Array<{ factor: string; grade_now: string | null }>;
};

function fmt(v: unknown): string {
  if (v == null || v === "") return "n/a";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : "n/a";
  return String(v);
}

function pickMetrics(m: Record<string, unknown> | null): string {
  if (!m) return "（无 basicFinancials）";
  const wanted: Record<string, string> = {
    peNormalizedAnnual: "PE (normalized)",
    peBasicExclExtraTTM: "PE (TTM)",
    pbAnnual: "PB",
    psAnnual: "PS",
    epsGrowthTTMYoy: "EPS YoY (TTM) %",
    revenueGrowthTTMYoy: "Revenue YoY (TTM) %",
    grossMarginTTM: "Gross Margin TTM %",
    operatingMarginTTM: "Operating Margin TTM %",
    roeTTM: "ROE TTM %",
    "52WeekHigh": "52W High $",
    "52WeekLow": "52W Low $",
    "52WeekPriceReturnDaily": "52W Return %",
    "26WeekPriceReturnDaily": "26W Return %",
    "13WeekPriceReturnDaily": "13W Return %",
    beta: "Beta",
    marketCapitalization: "Market Cap ($M)",
    dividendYieldIndicatedAnnual: "Dividend Yield %",
  };
  const lines: string[] = [];
  for (const [k, label] of Object.entries(wanted)) {
    if (k in m) lines.push(`- ${label}: ${fmt(m[k])}`);
  }
  return lines.length ? lines.join("\n") : "（basicFinancials 字段都为空）";
}

function pickNews(news: PickFactsheetInputs["news"]): string {
  if (!news || news.length === 0) return "（暂无近期 news）";
  return news
    .slice(0, 8)
    .map((n) => {
      const d = new Date(n.datetime * 1000).toISOString().slice(0, 10);
      return `- [${d}] ${n.headline}（${n.source}）`;
    })
    .join("\n");
}

function pickRatingBlock(r: PickFactsheetInputs["latestRating"]): string {
  if (!r) return "（暂无 OPS 评级——本次需独立判断 verdict 与目标价）";
  return [
    `- OPS Verdict: ${r.ops_verdict ?? "n/a"} (score ${fmt(r.ops_score)})`,
    `- OPS Target Price: $${fmt(r.ops_target_price)}`,
    `- Quant Score: ${fmt(r.quant_score)} / 5.00`,
    `- Street Target Price: $${fmt(r.street_target_price)}`,
    r.rank_overall && r.rank_overall_total
      ? `- 全市场排名: ${r.rank_overall} / ${r.rank_overall_total}`
      : "- 全市场排名: n/a",
    `- Industry: ${r.industry ?? "n/a"}`,
    `- 分红股: ${r.has_dividend ? "是" : "否"}`,
    r.last_refreshed_at ? `- 评级更新于: ${r.last_refreshed_at}` : "",
  ].filter(Boolean).join("\n");
}

function pickFactorBlock(grades: PickFactsheetInputs["factorGrades"]): string {
  const filled = grades.filter((g) => g.grade_now);
  if (filled.length === 0) return "（暂无因子档位）";
  return filled.map((g) => `- ${g.factor}: ${g.grade_now}`).join("\n");
}

export function buildPickUserPrompt(inputs: PickFactsheetInputs): string {
  const { symbol, name, sector, quote, metrics, news, latestRating, factorGrades } = inputs;
  const priceBlock = quote
    ? `- 现价 $${fmt(quote.c)}  (日涨跌 ${fmt(quote.d)} / ${fmt(quote.dp)}%)\n- 盘中高/低: $${fmt(quote.h)} / $${fmt(quote.l)}\n- 开/昨收: $${fmt(quote.o)} / $${fmt(quote.pc)}`
    : "（暂无实时报价——请基于 factsheet 给定方向，price 字段填 0）";

  return `# 任务
为 ${symbol} (${name}) 起草一条 OPS Pick（月度精选）。严格基于下方 Factsheet。

# Factsheet（**唯一权威数据源；未列内容视为未知**）

## 公司
- symbol: ${symbol}
- name: ${name}
- sector: ${sector ?? "n/a"}

## 实时报价
${priceBlock}

## 估值/成长/盈利/动量（basicFinancials）
${pickMetrics(metrics)}

## 最新 OPS 评级（已存在则直接复用 verdict 与目标价的方向）
${pickRatingBlock(latestRating)}

## 因子档位（grade_now）
${pickFactorBlock(factorGrades)}

## 近 30 天 news headlines
${pickNews(news)}

# 输出
严格按 system prompt 的 JSON schema 输出（**只输出 JSON 对象本身，不要任何额外文字**）。entry_price 直接用现价。如果 OPS 评级是 SELL/HOLD 但你认为论据不足以发 Pick，仍要输出 conviction="low" 的草稿，由 admin 复核。`;
}
