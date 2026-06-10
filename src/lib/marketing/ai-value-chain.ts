/** AI 产业六层价值链模型 · Steven Sun / OPS Capital */

export type ValueChainRep = {
  name: string;
  symbol?: string;
};

export type ValueChainLayer = {
  id: string;
  nameZh: string;
  roleZh: string;
  representatives: ValueChainRep[];
  trend2026: string;
};

export const AI_VALUE_CHAIN_LAYERS: ValueChainLayer[] = [
  {
    id: "L0",
    nameZh: "晶圆与制造极限",
    roleZh: "物理命脉层",
    representatives: [
      { name: "台积电", symbol: "TSM" },
      { name: "ASML", symbol: "ASML" },
      { name: "美光", symbol: "MU" },
    ],
    trend2026:
      "逼近物理极限；2nm GAA 工艺启动量产。先进封装（CoWoS）与 HBM4 / 专属级 DRAM 内存成为全行业物理瓶颈。",
  },
  {
    id: "L1",
    nameZh: "芯片与硬件设计",
    roleZh: "绝对定价权层",
    representatives: [
      { name: "英伟达", symbol: "NVDA" },
      { name: "AMD", symbol: "AMD" },
      { name: "高通", symbol: "QCOM" },
      { name: "Cerebras", symbol: "CBRS" },
      { name: "英特尔", symbol: "INTC" },
    ],
    trend2026:
      "结构性分化：算力需求从纯「GPU 训练」转向「通用 CPU 推理 / 调度」。Cerebras 巨型芯片（WSE-3）即将 IPO；NVIDIA 联手联发科入侵 PC 端芯片。",
  },
  {
    id: "L2",
    nameZh: "数据中心基建与算力云",
    roleZh: "新时代物理地产",
    representatives: [
      { name: "Equinix", symbol: "EQIX" },
      { name: "CoreWeave" },
      { name: "Nebius", symbol: "NBIS" },
    ],
    trend2026:
      "AI 时代的「数字地产」。能源与电网取代芯片成为最严峻瓶颈。中东与欧洲主权财富基金（SWF）以主权信用大举涌入，驱动本地化算力。",
  },
  {
    id: "L3",
    nameZh: "云计算与分发渠道",
    roleZh: "生态入口与蓄水池",
    representatives: [
      { name: "Microsoft Azure", symbol: "MSFT" },
      { name: "Google Cloud", symbol: "GOOGL" },
      { name: "Amazon AWS", symbol: "AMZN" },
    ],
    trend2026:
      "「CapEx 焦虑」与「估值杀伤」的重灾区。超大规模云厂商被迫出血切入 L4 大模型，并推动低成本推理专用 ASIC / CPU（如 Intel Crescent Island）以降本。",
  },
  {
    id: "L4",
    nameZh: "大模型研发商",
    roleZh: "风暴中心与超级黑盒",
    representatives: [
      { name: "OpenAI" },
      { name: "Anthropic" },
      { name: "Mistral" },
    ],
    trend2026:
      "华尔街 2026 年末的「终极考试」。OpenAI 与 Anthropic 预计年底前启动 IPO；「传闻时代」结束，真实营收、Token 成本与用户留存将被全面曝光。",
  },
  {
    id: "L5",
    nameZh: "终端应用与智能体",
    roleZh: "未来的价值终点",
    representatives: [
      { name: "AI Agent 平台" },
      { name: "垂直行业 SaaS" },
      { name: "Circle", symbol: "CRCL" },
    ],
    trend2026:
      "范式重塑：① 企业治理从「人力成本 HC」转向「Token 成本（算力消耗）」；② 传统前端 UI 被后端全自动 AI Agent 掏空。",
  },
];

const LAYER_MAP = new Map(AI_VALUE_CHAIN_LAYERS.map((l) => [l.id, l]));

export function getLayerById(id: string) {
  return LAYER_MAP.get(id.toUpperCase()) ?? null;
}

/** 该层所有可交易代码（去重、大写） */
export function getLayerSymbols(layer: ValueChainLayer): string[] {
  return [
    ...new Set(
      layer.representatives.map((r) => r.symbol?.toUpperCase()).filter((s): s is string => Boolean(s)),
    ),
  ];
}

export function getAllValueChainSymbols(): string[] {
  return [
    ...new Set(AI_VALUE_CHAIN_LAYERS.flatMap((l) => getLayerSymbols(l))),
  ];
}

export const INVESTMENT_FOCUS = [
  {
    k: "半导体制造链",
    body: "从晶圆代工、光刻设备到 HBM / 先进封装——追踪物理瓶颈与产能周期的定价权迁移。",
  },
  {
    k: "AI 算力基础设施",
    body: "GPU / ASIC 设计、数据中心 REIT、算力租赁与能源电网约束下的资本开支周期。",
  },
  {
    k: "大模型与 Agent 生态",
    body: "模型商业化兑现、云厂商 CapEx 博弈，以及 Token 经济驱动的应用层价值重估。",
  },
] as const;
