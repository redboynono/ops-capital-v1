export const ratingsSystemPrompt = `# Role: 量化评级系统 · 严格 JSON 输出

你是一个类似 Seeking Alpha Quant 的股票评级引擎。**user prompt 里的 Factsheet（Finnhub 实时财务 + 报价 + 新闻）是本次唯一权威数据源**，请基于它给出最合理的评级。

## 数据使用准则（最高优先级）
1. **所有评分必须基于 Factsheet 里的实际数字**，不要用训练记忆里的过期数据
2. Factsheet 未列的项（如某些分部营收、指引细节）→ 直接视为未知，评级时不考虑
3. 估值分档基于 factsheet 里的 PE/PB/PS 对比板块中位（如果板块中位没给，就看绝对分位）
4. Momentum 基于 52W 高低 + 当前价位 + 近 30 天 news 情绪
5. **3M/6M 评级本轮不要自行编造**（系统会从历史快照回填），**只填 "now" 档位**，m3/m6 可全填 null

## 评分口径（与 Seeking Alpha 一致）
- Valuation: PE / PB / PS / EV/EBITDA 相对同行 & 历史分位。越便宜越高分。
- Growth: 营收 / EPS / 经营现金流 TTM YoY。
- Profitability: 毛利率 / ROE / FCF margin。
- Momentum: 3/6/12 月相对强度。
- Revisions: 近 90 天分析师 EPS & 营收预测上调比例。
- DIV_*: 仅当 has_dividend=true 时填写，否则全填 null。

## JSON Schema
{
  "ops_verdict": "BUY",
  "ops_score": 4.20,
  "ops_target_price": 180.00,
  "street_verdict": "STRONG_BUY",
  "street_score": 4.55,
  "street_target_price": 195.00,
  "street_analyst_count": 48,
  "industry": "Semiconductors",
  "rank_overall": 120,
  "rank_overall_total": 4200,
  "rank_sector": 8,
  "rank_sector_total": 620,
  "rank_industry": 2,
  "rank_industry_total": 52,
  "has_dividend": false,
  "factors": {
    "VALUATION":     { "now": "D",  "m3": null, "m6": null },
    "GROWTH":        { "now": "A+", "m3": null, "m6": null },
    "PROFITABILITY": { "now": "A+", "m3": null, "m6": null },
    "MOMENTUM":      { "now": "B+", "m3": null, "m6": null },
    "REVISIONS":     { "now": "A+", "m3": null, "m6": null },
    "DIV_SAFETY":     null,
    "DIV_GROWTH":     null,
    "DIV_YIELD":      null,
    "DIV_CONSISTENCY":null
  },
  "notes": "一句话投资要点，<=60 字。"
}

## 硬约束
- 不要任何其他字段
- 不要包裹在 markdown code fence 中
- 字符串严格用双引号
- 不知道的数字填 null，但评级要尽量给出`;

/**
 * Legacy signature (no factsheet) — kept for backwards compat with tests.
 * New code should use `buildRatingsUserPromptWithFactsheet` instead.
 */
export function buildRatingsUserPrompt(symbol: string, name?: string, sector?: string, focus?: string) {
  return [
    `标的代码: ${symbol}`,
    name ? `标的名称: ${name}` : "",
    sector ? `所属板块: ${sector}` : "",
    focus ? `补充关注: ${focus}` : "",
    "",
    "请输出该标的最新的 OPS Rating JSON（严格按上方 schema，不要任何额外文本）。",
  ].filter(Boolean).join("\n");
}

export type RatingFactsheetInputs = {
  symbol: string;
  name: string;
  sector: string | null;
  quote: { c: number; d?: number | null; dp?: number | null; h: number; l: number; o: number; pc: number } | null;
  metrics: Record<string, unknown> | null;
  news: Array<{ datetime: number; headline: string; source: string; summary?: string }>;
};

function fmt(v: unknown): string {
  if (v == null || v === "") return "n/a";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : "n/a";
  return String(v);
}

function pickMetrics(m: Record<string, unknown> | null): string {
  if (!m) return "（无 basicFinancials）";
  const picks: Record<string, string> = {
    peNormalizedAnnual: "PE (normalized annual)",
    peBasicExclExtraTTM: "PE (TTM)",
    pbAnnual: "PB",
    psAnnual: "PS",
    epsGrowthTTMYoy: "EPS YoY (TTM) %",
    revenueGrowthTTMYoy: "Revenue YoY (TTM) %",
    grossMarginTTM: "Gross Margin TTM %",
    operatingMarginTTM: "Operating Margin TTM %",
    roeTTM: "ROE TTM %",
    roiTTM: "ROI TTM %",
    fcfMargin5Y: "FCF Margin 5Y %",
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
  for (const [k, label] of Object.entries(picks)) {
    if (k in m) lines.push(`- ${label}: ${fmt(m[k])}`);
  }
  return lines.length ? lines.join("\n") : "（basicFinancials 字段都为空）";
}

function pickNews(news: RatingFactsheetInputs["news"]): string {
  if (!news || news.length === 0) return "（暂无近期 news）";
  return news
    .slice(0, 6)
    .map((n) => {
      const d = new Date(n.datetime * 1000).toISOString().slice(0, 10);
      return `- [${d}] ${n.headline}（${n.source}）`;
    })
    .join("\n");
}

export function buildRatingsUserPromptWithFactsheet(inputs: RatingFactsheetInputs): string {
  const { symbol, name, sector, quote, metrics, news } = inputs;
  const priceBlock = quote
    ? `- 现价 $${fmt(quote.c)}  (日涨跌 ${fmt(quote.d)} / ${fmt(quote.dp)}%)\n- 盘中高/低: $${fmt(quote.h)} / $${fmt(quote.l)}\n- 开/昨收: $${fmt(quote.o)} / $${fmt(quote.pc)}`
    : "（暂无实时报价）";

  return `# 任务
为 ${symbol} (${name}) 输出最新 OPS Rating JSON，严格基于下方 Factsheet。

# Factsheet（**唯一权威数据源；未列内容视为未知**）

## 公司
- symbol: ${symbol}
- name: ${name}
- sector: ${sector ?? "n/a"}

## 实时报价（Finnhub /quote）
${priceBlock}

## 估值 / 成长 / 盈利 / 动量（Finnhub /stock/metric basicFinancials）
${pickMetrics(metrics)}

## 近 30 天 news headlines（Finnhub /company-news）
${pickNews(news)}

# 输出
严格按 system prompt 的 JSON schema 输出。factors.*.now 必须给出；m3/m6 全部填 null（系统会从历史快照回填）。`;
}
