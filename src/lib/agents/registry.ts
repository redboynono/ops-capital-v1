/**
 * Agent registry — 所有可用 Agent 的声明式定义。
 *
 * 每个 Agent 是：
 *   - id (URL safe)
 *   - 元数据（名字、emoji、分类、用户能看到的描述）
 *   - inputKind: 接受 ticker / post / freeform
 *   - buildContext: 拿到输入 + userId，构建喂给 LLM 的 markdown 字符串
 *   - systemPrompt: 固定的角色 prompt
 *   - userPromptTemplate: 拼 context 的模板，{context} 会被替换
 *
 * 增加新 Agent = 加一个 entry，无需改 API / UI。
 */

import {
  buildBaseTickerContext,
  buildNewsRecapContext,
  buildPeerComparisonContext,
  buildPositionAdviceContext,
  buildUpcomingEventsContext,
} from "@/lib/agents/context-builders";

export type AgentCategory =
  | "valuation"
  | "comparison"
  | "narrative"
  | "events"
  | "portfolio";

export type AgentInput =
  | { kind: "ticker"; symbol: string }
  | { kind: "post"; slug: string }
  | { kind: "freeform"; query: string };

export type AgentBuildResult = {
  context: string;
  meta?: Record<string, unknown>;
};

export type AgentDefinition = {
  id: string;
  name: string;
  emoji: string;
  category: AgentCategory;
  short: string;
  description: string;
  inputKind: AgentInput["kind"];
  estimatedSeconds: number;
  maxTokens?: number;
  buildContext: (input: AgentInput, opts: { userId: string }) => Promise<AgentBuildResult>;
  systemPrompt: string;
  /** 模板里 {context} 会被替换为 buildContext 返回的字符串。 */
  userPromptTemplate: string;
};

// ============================================================
// 共享 system prompt（所有 ticker Agent 共用基底，再叠各 Agent 的 task 指令）
// ============================================================

const SHARED_GUARDRAILS = `# 数据使用准则（最高优先级）
1. 用户消息包含一段 **Factsheet**（实时报价 + 公司概况 + 估值/财务 + OPS 评级 + 近 14 天 news），它是**唯一权威数据源**。
2. 涉及股价、市值、估值倍数、52W 高低、IPO 日期、CEO、近期事件 → 严格使用 factsheet 里的数字，禁止依赖训练记忆。
3. factsheet 没列的内容 → 写"未公开披露"或在数字后加 *（推断）* 标记。
4. 训练截止后发生的价格变动是常态（如 IPO 后涨跌 5×+），factsheet 里的价格才是真实当前价。
5. 严禁把同名旧标的（例如 2024 之前训练语料里的另一个 "CRCL"）误配成本标的。

# 输出风格
- 中文回答；冷静、机构级、无情绪修饰
- 用 Markdown：合理用标题 / 列表 / 表格
- 不要客套话、不要免责声明、不要"投资有风险"那种话
- 不写"（以上分析仅供参考）"之类的尾部废话

# Guardrails
- 不给具体买入 / 卖出 / 加仓 / 减仓的指令；可以分析利弊但留给用户决策
- 不保证收益、不预测精确价格点位
- 不引用 factsheet 之外的"内幕"或捏造数据`;

// ============================================================
// 6 个 Agent 定义
// ============================================================

export const AGENTS: Record<string, AgentDefinition> = {
  // ---------- 1. DCF 估值 ----------
  "dcf-valuation": {
    id: "dcf-valuation",
    name: "DCF 估值速算",
    emoji: "📊",
    category: "valuation",
    short: "10 年 DCF 推算内在价值 + 敏感度",
    description:
      "基于 factsheet 的当前营收、利润率、增长率，做 10 年 DCF 模型（5 年高增长 + 5 年衰减 + 终值），输出内在价值区间、与现价的隐含上下行、对 WACC / 终值增长率的敏感度。",
    inputKind: "ticker",
    estimatedSeconds: 35,
    maxTokens: 8000,
    buildContext: async (input) => {
      if (input.kind !== "ticker") throw new Error("dcf-valuation requires ticker");
      const ctx = await buildBaseTickerContext(input.symbol);
      return { context: ctx };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"估值分析 Agent"。专长：DCF 与相对估值。
${SHARED_GUARDRAILS}

# 任务
对给定标的做一份**精炼的 DCF 估值快照**，结构如下：

1. **关键假设表** —— 表格形式：
   | 项目 | 数值 | 依据 |
   - revenue 当前 / 5 年 CAGR / 衰减后 5 年 CAGR
   - operating margin（当前 / 稳态）
   - tax rate / capex/revenue / 营运资本变动占比
   - WACC（用 beta + 无风险利率 + 风险溢价 推一下）
   - terminal growth rate（≤ 长期通胀+实际增长，≤3.5%）

2. **DCF 计算结果**（不需要逐年表，只给关键节点）：
   - PV of FCF (year 1-10)
   - PV of terminal value
   - Enterprise Value → Equity Value（扣净债务）
   - 每股内在价值
   - 与现价对比的隐含上行/下行 %

3. **敏感度表**（2D，可读）：
   - 行：WACC ±1%
   - 列：terminal growth ±0.5%
   - 单元：每股内在价值

4. **结论一句话**：内在价值落在 \$X-Y 区间，相对现价 \$Z 是高估/合理/低估 N%。

不要写步骤推导过程，只给结果 + 关键假设。`,
    userPromptTemplate: `# Factsheet\n{context}\n\n----\n\n请基于以上数据，对这只标的做 DCF 估值快照。`,
  },

  // ---------- 2. 同业对比 ----------
  "peer-comparison": {
    id: "peer-comparison",
    name: "同业横向对比",
    emoji: "📉",
    category: "comparison",
    short: "估值 / 增长 / 盈利 vs 4 只同业对照",
    description:
      "自动找同行业 4 只对照标的，输出估值倍数（PE / PS / PB / EV-EBITDA）、营收增速、毛利率、ROE 的横向对比表，标出本只在 quartile 中的位置，以及估值溢价/折价的合理性判断。",
    inputKind: "ticker",
    estimatedSeconds: 30,
    maxTokens: 7000,
    buildContext: async (input) => {
      if (input.kind !== "ticker") throw new Error("peer-comparison requires ticker");
      const r = await buildPeerComparisonContext(input.symbol);
      return { context: r.context, meta: { peers: r.peers } };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"同业对比 Agent"。专长：横向估值与盈利对照。
${SHARED_GUARDRAILS}

# 任务
对给定标的 + 4 只同行业对照，输出：

1. **横向对比表**（Markdown 表格）：
   | 代码 | PE TTM | PS TTM | PB | ROE% | 营收增速 5Y | 毛利率% | 市值 |
   |---|---|---|---|---|---|---|---|
   - 第一行就是本标的（用 **粗体** 突出）
   - 缺数据用 "—"，不要瞎填

2. **位置判定**：
   - 估值（PE / PS / PB）在同业中处于 Q1 / Q2 / Q3 / Q4
   - 增长在同业中处于哪个分位
   - 盈利能力在哪个分位

3. **溢价 / 折价判断**（3-5 句话）：
   - 这只是否相对同业高估？高估的合理理由（增长更强？护城河更深？市占率？）
   - 如果是折价，是 value 机会还是价值陷阱？

不要长篇分析，只给表格 + 简短结论。`,
    userPromptTemplate: `# Factsheet（本标的 + 4 只同业对照）\n{context}\n\n----\n\n请输出同业横向对比表 + 估值位置判定。`,
  },

  // ---------- 3. 新闻复盘 ----------
  "news-recap": {
    id: "news-recap",
    name: "30 天新闻复盘",
    emoji: "📰",
    category: "narrative",
    short: "事件时间线 + 主线叙事 + 后续观察点",
    description:
      "拉过去 30 天的全部新闻，重组成时间线（事件 + 股价反应），提炼出 2-3 条核心叙事主线，最后给出未来 4-6 周需要重点观察的事件 / 数据点。",
    inputKind: "ticker",
    estimatedSeconds: 30,
    maxTokens: 7000,
    buildContext: async (input) => {
      if (input.kind !== "ticker") throw new Error("news-recap requires ticker");
      const r = await buildNewsRecapContext(input.symbol, 30);
      return { context: r.context, meta: { newsCount: r.newsCount } };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"新闻复盘 Agent"。专长：从新闻流里抽出叙事主线。
${SHARED_GUARDRAILS}

# 任务
对过去 30 天的新闻流做结构化复盘：

1. **事件时间线**（Markdown 列表，按时间倒序）：
   - 2026-XX-XX · 标题 · 影响方向（中性 / 利好 / 利空）· 一句话解读
   - 只挑 5-8 个真正关键的事件，不要把所有 headline 都列出
   - 重大事件用 **粗体**

2. **核心叙事主线**（2-3 条）：
   - 每条用一个简短小标题 + 2-3 句解释
   - 这些主线是"市场现在如何看这只股"的提炼

3. **后续观察点（未来 4-6 周）**：
   - 需要持续跟踪的具体事件 / 数据 / 公告
   - 触发事件 → 可能的方向

不写废话，全部围绕"这 30 天发生了什么 + 这意味着什么 + 接下来看什么"。`,
    userPromptTemplate: `# Factsheet + 过去 30 天新闻流\n{context}\n\n----\n\n请输出 30 天新闻复盘。`,
  },

  // ---------- 4. Bull / Bear 论点 ----------
  "bull-bear": {
    id: "bull-bear",
    name: "Bull / Bear 论点书",
    emoji: "🎯",
    category: "narrative",
    short: "5 条 bull + 5 条 bear + 关键 catalyst",
    description:
      "围绕标的当前价格，列出 5 条做多论点 + 5 条做空论点（每条都基于 factsheet 数据，不要拍脑袋），再给出 3 个未来 6 个月内能让其中一方占优的具体催化剂。",
    inputKind: "ticker",
    estimatedSeconds: 25,
    maxTokens: 6000,
    buildContext: async (input) => {
      if (input.kind !== "ticker") throw new Error("bull-bear requires ticker");
      const ctx = await buildBaseTickerContext(input.symbol);
      return { context: ctx };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"多空论点 Agent"。专长：把投资逻辑拆成可证伪的具体陈述。
${SHARED_GUARDRAILS}

# 任务
围绕标的当前价格，输出：

## 🟢 Bull Case（5 条）
按"重要性递减"排列。每条格式：
> **N. 一句话核心论点**
> 数据/事实支撑（必须引用 factsheet 里的具体数字）
> 验证条件：什么数据 / 事件出现，能证明这条对/错

## 🔴 Bear Case（5 条）
同上格式。

## ⚡ 未来 6 个月关键 Catalyst（3 个）
每个 catalyst 写：
- 具体事件（财报 / 监管 / 产品 / 宏观）
- 时间窗口
- 利好 bull 还是 bear，幅度判断

不要写"投资风险因素列表"那种凑数的话，每条 bull/bear 都必须可证伪。`,
    userPromptTemplate: `# Factsheet\n{context}\n\n----\n\n请输出 Bull/Bear 论点书 + 关键 catalyst。`,
  },

  // ---------- 5. 未来事件 ----------
  "upcoming-events": {
    id: "upcoming-events",
    name: "未来 90 天事件雷达",
    emoji: "📅",
    category: "events",
    short: "财报 / 行业事件 / 宏观节奏 全图",
    description:
      "整合该标的未来 120 天财报日 + 行业关键事件 + 宏观节奏（FOMC / CPI 等），给出每个事件对该标的的预期影响方向 + 应对建议。",
    inputKind: "ticker",
    estimatedSeconds: 25,
    maxTokens: 6000,
    buildContext: async (input) => {
      if (input.kind !== "ticker") throw new Error("upcoming-events requires ticker");
      const r = await buildUpcomingEventsContext(input.symbol);
      return { context: r.context, meta: { upcomingEarnings: r.upcomingCount } };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"未来事件雷达 Agent"。专长：把日程表上的未知点变成"现在就该准备什么"。
${SHARED_GUARDRAILS}

# 任务
按时间顺序输出未来 90 天的事件清单，分三列：

| 日期 / 时间窗口 | 事件 | 类型 | 预期影响 |
|---|---|---|---|
- 类型分：财报 / 行业事件 / 宏观 / 公司事件（产品发布 / 投资者日 / 锁定期到期）
- 影响方向：📈 利好 / 📉 利空 / ⚖️ 中性 / ❓ 不确定
- 影响力度：高 / 中 / 低

# 之后输出
**🎯 关键事件 Top 3**：哪 3 个事件最值得提前布置（写明时间 + 该如何准备 / 观察什么）

不要列废话事件，只列对持仓决策有意义的。`,
    userPromptTemplate: `# Factsheet + 已知财报 + 通用宏观节奏\n{context}\n\n----\n\n请输出未来 90 天事件雷达。`,
  },

  // ---------- 6. 持仓建议 ----------
  "position-advice": {
    id: "position-advice",
    name: "仓位结构分析",
    emoji: "💰",
    category: "portfolio",
    short: "结合你的现有持仓给加 / 减 / 持判断",
    description:
      "结合用户当前在该标的的持仓 + 整个组合分散度，从风险预算角度判断是建仓 / 加仓 / 减仓 / 持有。不会给具体股数指令，但会给逻辑框架。",
    inputKind: "ticker",
    estimatedSeconds: 25,
    maxTokens: 6000,
    buildContext: async (input, opts) => {
      if (input.kind !== "ticker") throw new Error("position-advice requires ticker");
      const r = await buildPositionAdviceContext(input.symbol, opts.userId);
      return { context: r.context, meta: { hasPosition: r.hasPosition } };
    },
    systemPrompt: `# Role
你是 OPS Alpha 投研终端的"仓位结构 Agent"。专长：从风险预算 / 分散度角度给加减仓框架。
${SHARED_GUARDRAILS}

# 任务
结合用户**当前在该标的的持仓**和**整个组合分散度**，输出：

## 1. 当前仓位评估（如果有持仓）
- 浮盈/浮亏 %（用 factsheet 现价 - 持仓均价）
- 该标的占组合的近似权重（按市值估算）
- 组合在该 sector 的集中度评估

## 2. 估值视角
- 现价相对内在价值的位置（用 factsheet 数据简推一下）
- 同行业相对位置

## 3. 行动框架（不是指令，是判断逻辑）
**应该考虑加仓的情形**：
- 列出 2-3 个"如果 X 发生 → 加仓合理"的条件

**应该考虑减仓 / 止盈的情形**：
- 列出 2-3 个"如果 X 发生 → 应减仓"的条件

**当前更倾向**：建仓 / 加仓 / 持有 / 减仓 / 清仓 中的哪个，**用一行说明主因**。

⚠️ 严格禁止写"建议买入 X 股"或"立即卖出"之类的指令性语言。
全部以"如果...那么..."的条件式给出，决策权留给用户。`,
    userPromptTemplate: `# Factsheet + 用户持仓状态\n{context}\n\n----\n\n请输出仓位结构分析。`,
  },
};

export function getAgent(id: string): AgentDefinition | null {
  return AGENTS[id] ?? null;
}

export function listAgents(): AgentDefinition[] {
  return Object.values(AGENTS);
}

export function listAgentsByInput(kind: AgentInput["kind"]): AgentDefinition[] {
  return listAgents().filter((a) => a.inputKind === kind);
}
