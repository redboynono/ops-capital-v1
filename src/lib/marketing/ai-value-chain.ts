/** AI 产业六层价值链模型 · Steven Sun / OPS Capital */

import type { Locale } from "@/lib/i18n/locale-types";

export type ValueChainRep = {
  name: string;
  symbol?: string;
};

export type ValueChainLayer = {
  id: string;
  nameZh: string;
  nameEn: string;
  roleZh: string;
  roleEn: string;
  representatives: ValueChainRep[];
  trend2026: string;
  trend2026En: string;
};

export const AI_VALUE_CHAIN_LAYERS: ValueChainLayer[] = [
  {
    id: "L0",
    nameZh: "晶圆与制造极限",
    nameEn: "Wafer fabs & manufacturing limits",
    roleZh: "物理命脉层",
    roleEn: "Physical lifeline",
    representatives: [
      { name: "台积电", symbol: "TSM" },
      { name: "ASML", symbol: "ASML" },
      { name: "美光", symbol: "MU" },
    ],
    trend2026:
      "逼近物理极限；2nm GAA 工艺启动量产。先进封装（CoWoS）与 HBM4 / 专属级 DRAM 内存成为全行业物理瓶颈。",
    trend2026En:
      "Approaching physics limits; 2nm GAA enters volume production. Advanced packaging (CoWoS) and HBM4 / specialty DRAM are the industry's physical bottlenecks.",
  },
  {
    id: "L1",
    nameZh: "芯片与硬件设计",
    nameEn: "Chip & hardware design",
    roleZh: "绝对定价权层",
    roleEn: "Pricing power layer",
    representatives: [
      { name: "英伟达", symbol: "NVDA" },
      { name: "AMD", symbol: "AMD" },
      { name: "高通", symbol: "QCOM" },
      { name: "Cerebras", symbol: "CBRS" },
      { name: "英特尔", symbol: "INTC" },
    ],
    trend2026:
      "结构性分化：算力需求从纯「GPU 训练」转向「通用 CPU 推理 / 调度」。Cerebras 巨型芯片（WSE-3）即将 IPO；NVIDIA 联手联发科入侵 PC 端芯片。",
    trend2026En:
      "Structural split: compute demand shifts from GPU training to general CPU inference/scheduling. Cerebras WSE-3 nears IPO; NVIDIA partners on PC silicon.",
  },
  {
    id: "L2",
    nameZh: "数据中心基建与算力云",
    nameEn: "Data-center infra & compute cloud",
    roleZh: "新时代物理地产",
    roleEn: "Digital real estate",
    representatives: [
      { name: "Equinix", symbol: "EQIX" },
      { name: "CoreWeave" },
      { name: "Nebius", symbol: "NBIS" },
    ],
    trend2026:
      "AI 时代的「数字地产」。能源与电网取代芯片成为最严峻瓶颈。中东与欧洲主权财富基金（SWF）以主权信用大举涌入，驱动本地化算力。",
    trend2026En:
      "Digital real estate for AI. Power grids—not chips—are the tightest constraint. MENA & European SWFs deploy sovereign capital into localized compute.",
  },
  {
    id: "L3",
    nameZh: "云计算与分发渠道",
    nameEn: "Cloud & distribution",
    roleZh: "生态入口与蓄水池",
    roleEn: "Ecosystem gateway",
    representatives: [
      { name: "Microsoft Azure", symbol: "MSFT" },
      { name: "Google Cloud", symbol: "GOOGL" },
      { name: "Amazon AWS", symbol: "AMZN" },
    ],
    trend2026:
      "「CapEx 焦虑」与「估值杀伤」的重灾区。超大规模云厂商被迫出血切入 L4 大模型，并推动低成本推理专用 ASIC / CPU（如 Intel Crescent Island）以降本。",
    trend2026En:
      "CapEx anxiety & valuation damage zone. Hyperscalers bleed into L4 models while pushing low-cost inference ASICs/CPUs (e.g. Intel Crescent Island) to cut unit economics.",
  },
  {
    id: "L4",
    nameZh: "大模型研发商",
    nameEn: "Foundation model labs",
    roleZh: "风暴中心与超级黑盒",
    roleEn: "Storm center & black box",
    representatives: [
      { name: "OpenAI" },
      { name: "Anthropic" },
      { name: "Mistral" },
    ],
    trend2026:
      "华尔街 2026 年末的「终极考试」。OpenAI 与 Anthropic 预计年底前启动 IPO；「传闻时代」结束，真实营收、Token 成本与用户留存将被全面曝光。",
    trend2026En:
      "Wall Street's year-end 2026 exam: OpenAI & Anthropic IPOs expected; rumor era ends—real revenue, token costs, and retention get audited.",
  },
  {
    id: "L5",
    nameZh: "终端应用与智能体",
    nameEn: "Apps & AI agents",
    roleZh: "未来的价值终点",
    roleEn: "End-state value layer",
    representatives: [
      { name: "AI Agent 平台" },
      { name: "垂直行业 SaaS" },
      { name: "Circle", symbol: "CRCL" },
    ],
    trend2026:
      "范式重塑：① 企业治理从「人力成本 HC」转向「Token 成本（算力消耗）」；② 传统前端 UI 被后端全自动 AI Agent 掏空。",
    trend2026En:
      "Paradigm shift: ① corporate ops move from headcount to token spend; ② classic front-end UI hollowed out by autonomous backend agents.",
  },
];

const LAYER_MAP = new Map(AI_VALUE_CHAIN_LAYERS.map((l) => [l.id, l]));

export function getLayerById(id: string) {
  return LAYER_MAP.get(id.toUpperCase()) ?? null;
}

export function layerLocalized(layer: ValueChainLayer, locale: Locale) {
  return {
    name: locale === "en" ? layer.nameEn : layer.nameZh,
    role: locale === "en" ? layer.roleEn : layer.roleZh,
    trend: locale === "en" ? layer.trend2026En : layer.trend2026,
  };
}

/** 该层所有可交易代码（去重、大写） */
export function getLayerSymbols(layer: ValueChainLayer): string[] {
  return [
    ...new Set(
      layer.representatives.map((r) => r.symbol?.toUpperCase()).filter((s): s is string => Boolean(s)),
    ),
  ];
}

/** 某个 ticker 所属的价值链层（用于 X 叙事 thread 的六层框架钩子）；找不到返回 null */
export function findLayerForSymbol(symbol: string): ValueChainLayer | null {
  const s = symbol.toUpperCase();
  return (
    AI_VALUE_CHAIN_LAYERS.find((l) =>
      l.representatives.some((r) => r.symbol?.toUpperCase() === s),
    ) ?? null
  );
}

export function getAllValueChainSymbols(): string[] {
  return [
    ...new Set(AI_VALUE_CHAIN_LAYERS.flatMap((l) => getLayerSymbols(l))),
  ];
}

export const INVESTMENT_FOCUS = [
  {
    k: "半导体制造链",
    kEn: "Semiconductor manufacturing",
    body: "从晶圆代工、光刻设备到 HBM / 先进封装——追踪物理瓶颈与产能周期的定价权迁移。",
    bodyEn: "From foundries and lithography to HBM / advanced packaging—track pricing power through physical bottlenecks and capacity cycles.",
  },
  {
    k: "AI 算力基础设施",
    kEn: "AI compute infrastructure",
    body: "GPU / ASIC 设计、数据中心 REIT、算力租赁与能源电网约束下的资本开支周期。",
    bodyEn: "GPU / ASIC design, data-center REITs, compute leasing, and capex cycles under power-grid constraints.",
  },
  {
    k: "大模型与 Agent 生态",
    kEn: "Models & agent ecosystem",
    body: "模型商业化兑现、云厂商 CapEx 博弈，以及 Token 经济驱动的应用层价值重估。",
    bodyEn: "Model monetization, hyperscaler CapEx games, and token-economy-driven app-layer repricing.",
  },
] as const;

export function investmentFocusLocalized(locale: Locale) {
  return INVESTMENT_FOCUS.map((f) => ({
    k: locale === "en" ? f.kEn : f.k,
    body: locale === "en" ? f.bodyEn : f.body,
  }));
}
