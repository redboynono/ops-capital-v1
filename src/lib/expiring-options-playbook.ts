import {
  listExpiringOptionsRadar,
  type ExpiringOptionHighlight,
  type Underlying0DteSummary,
} from "@/lib/expiring-options";

export type PlayBias = "bullish" | "bearish" | "neutral";
export type PlayAction = "跟涨" | "跟跌" | "观望";
export type PlayConfidence = "高" | "中" | "低";

export type FollowLeg = {
  underlying: string;
  action: PlayAction;
  bias: PlayBias;
  confidence: PlayConfidence;
  headline: string;
  contractType: "call" | "put";
  strike: number;
  underlyingPrice: number | null;
  volume: number;
  moneyness: "ATM" | "OTM" | "ITM";
  steps: string[];
  riskNote: string;
};

export type TodayExpiringOptionsPlaybook = {
  expirationDate: string;
  marketMood: string;
  /** 最多 3 条，优先指数，适合普通人跟单 */
  followPicks: FollowLeg[];
  /** 通用纪律，每日固定 */
  discipline: string[];
  summaries: Underlying0DteSummary[];
  disclaimer: string;
};

const INDEX_FIRST = new Set(["SPY", "QQQ", "IWM"]);
const MIN_TOTAL_VOL = 800;
const BIAS_RATIO = 1.25;

function moneyness(
  type: "call" | "put",
  strike: number,
  spot: number | null,
): "ATM" | "OTM" | "ITM" {
  if (spot == null || spot <= 0) return "ATM";
  const pct = Math.abs(strike - spot) / spot;
  if (pct <= 0.008) return "ATM";
  if (type === "call") return strike > spot ? "OTM" : "ITM";
  return strike < spot ? "OTM" : "ITM";
}

function pickNearAtm(
  contracts: ExpiringOptionHighlight[],
  type: "call" | "put",
  spot: number | null,
): ExpiringOptionHighlight | null {
  const side = contracts.filter((c) => c.contractType === type && c.volume > 0);
  if (side.length === 0) return null;
  if (spot == null) return side.sort((a, b) => b.volume - a.volume)[0] ?? null;

  return (
    [...side]
      .sort((a, b) => {
        const da = Math.abs(a.strike - spot);
        const db = Math.abs(b.strike - spot);
        if (da !== db) return da - db;
        return b.volume - a.volume;
      })
      .find((c) => Math.abs(c.strike - spot) / spot <= 0.02) ??
    side.sort((a, b) => b.volume - a.volume)[0] ??
    null
  );
}

function biasFromVolumes(callVol: number, putVol: number): PlayBias {
  if (callVol >= putVol * BIAS_RATIO) return "bullish";
  if (putVol >= callVol * BIAS_RATIO) return "bearish";
  return "neutral";
}

function actionLabel(bias: PlayBias): PlayAction {
  if (bias === "bullish") return "跟涨";
  if (bias === "bearish") return "跟跌";
  return "观望";
}

function confidenceFromVol(total: number, bias: PlayBias): PlayConfidence {
  if (bias === "neutral") return "低";
  if (total >= 50_000) return "高";
  if (total >= 8_000) return "中";
  return "低";
}

function buildHeadline(u: string, action: PlayAction, bias: PlayBias, total: number): string {
  const flow =
    bias === "bullish"
      ? "当日成交偏多在上游 Call"
      : bias === "bearish"
        ? "当日成交偏多在上游 Put"
        : "多空成交接近，方向不清晰";
  if (action === "观望") {
    return `${u}：${flow}，今日以观望为主`;
  }
  return `${u}：${flow}，可考虑轻仓${action}`;
}

function buildSteps(action: PlayAction, leg: FollowLeg): string[] {
  const sym = leg.underlying;
  const typeZh = leg.contractType === "call" ? "看涨 Call" : "看跌 Put";
  const strike = leg.strike;

  if (action === "观望") {
    return [
      `今日 ${sym} 末日期权暂不新开仓，等方向更清晰或改做 SPY/QQQ 指数。`,
      "若已持仓：设定止损，14:30 后不加仓。",
      "15:50 前平掉所有当日到期合约，不留隔夜。",
    ];
  }

  return [
    `在券商搜索 ${sym}、到期日为「今天」的 ${typeZh}，行权价 ${strike}（${leg.moneyness}）。`,
    `仅用小仓位试单（建议 ≤ 可承受亏损资金的 3%），成交后立刻设止损。`,
    "14:30 后不再新开仓；15:50 前全部平仓。末日期权时间价值衰减极快。",
  ];
}

function legFromSummary(
  s: Underlying0DteSummary,
  contracts: ExpiringOptionHighlight[],
): FollowLeg | null {
  const action = actionLabel(s.bias);
  const spot = s.underlyingPrice;
  const contract =
    s.bias === "bullish"
      ? pickNearAtm(contracts, "call", spot)
      : s.bias === "bearish"
        ? pickNearAtm(contracts, "put", spot)
        : null;

  if (action === "观望" || !contract) {
    if (s.totalVolume < MIN_TOTAL_VOL) return null;
    return {
      underlying: s.underlying,
      action: "观望",
      bias: s.bias,
      confidence: "低",
      headline: buildHeadline(s.underlying, "观望", s.bias, s.totalVolume),
      contractType: "call",
      strike: spot ?? 0,
      underlyingPrice: spot,
      volume: 0,
      moneyness: "ATM",
      steps: buildSteps("观望", {
        underlying: s.underlying,
        action: "观望",
        bias: s.bias,
        confidence: "低",
        headline: "",
        contractType: "call",
        strike: 0,
        underlyingPrice: spot,
        volume: 0,
        moneyness: "ATM",
        steps: [],
        riskNote: "",
      }),
      riskNote: "方向不明时不宜强行跟单。",
    };
  }

  const conf = confidenceFromVol(s.totalVolume, s.bias);
  const leg: FollowLeg = {
    underlying: s.underlying,
    action,
    bias: s.bias,
    confidence: conf,
    headline: buildHeadline(s.underlying, action, s.bias, s.totalVolume),
    contractType: contract.contractType,
    strike: contract.strike,
    underlyingPrice: spot,
    volume: contract.volume,
    moneyness: moneyness(contract.contractType, contract.strike, spot),
    steps: [],
    riskNote:
      INDEX_FIRST.has(s.underlying)
        ? "指数流动性好，但仍可能全天归零，务必小仓+止损。"
        : "个股波动更大，新手优先 SPY/QQQ，勿重仓单票。",
  };
  leg.steps = buildSteps(action, leg);
  return leg;
}

function marketMoodText(summaries: Underlying0DteSummary[]): string {
  const idx = summaries.filter((s) => INDEX_FIRST.has(s.underlying) && s.totalVolume >= MIN_TOTAL_VOL);
  const bull = idx.filter((s) => s.bias === "bullish").length;
  const bear = idx.filter((s) => s.bias === "bearish").length;
  if (idx.length === 0) return "今日指数末日期权成交偏淡，整体宜降低仓位、以观望为主。";
  if (bull >= 2 && bear === 0) return "宽基指数（SPY/QQQ/IWM）成交偏多在上游 Call，大盘情绪偏暖，可轻仓跟涨但严守止损。";
  if (bear >= 2 && bull === 0) return "宽基指数成交偏多在上游 Put，情绪偏谨慎，可轻仓跟跌或观望，勿逆势重仓。";
  if (bull > bear) return "指数多空交织但略偏多，优先跟 SPY/QQQ 的 Call 方向，个股末日期权次之。";
  if (bear > bull) return "指数多空交织但略偏空，优先跟 SPY/QQQ 的 Put 方向或观望。";
  return "指数多空成交接近，今日以震荡思路对待，减小仓位、缩短持仓时间。";
}

export async function buildTodayExpiringOptionsPlaybook(): Promise<TodayExpiringOptionsPlaybook> {
  const { expirationDate, summaries, byUnderlying } = await listExpiringOptionsRadar({
    globalLimit: 120,
    topPerUnderlying: 80,
  });

  const ranked = summaries
    .filter((s) => s.totalVolume >= MIN_TOTAL_VOL)
    .sort((a, b) => {
      const ai = INDEX_FIRST.has(a.underlying) ? 1 : 0;
      const bi = INDEX_FIRST.has(b.underlying) ? 1 : 0;
      if (bi !== ai) return bi - ai;
      return b.totalVolume - a.totalVolume;
    });

  const followPicks: FollowLeg[] = [];
  for (const s of ranked) {
    if (followPicks.length >= 3) break;
    const contracts = byUnderlying[s.underlying] ?? [];
    const leg = legFromSummary(s, contracts);
    if (!leg) continue;
    if (leg.action === "观望" && !INDEX_FIRST.has(s.underlying)) continue;
    followPicks.push(leg);
  }

  if (followPicks.length === 0 && ranked.length > 0) {
    const s = ranked[0];
    const leg = legFromSummary(s, byUnderlying[s.underlying] ?? []);
    if (leg) followPicks.push(leg);
  }

  return {
    expirationDate,
    marketMood: marketMoodText(summaries),
    followPicks,
    discipline: [
      "末日期权当天到期，错方向可能本金接近归零，仅用可完全亏掉的闲钱。",
      "单笔投入建议 ≤ 总资金的 3%，且必须设止损；14:30 后不再新开仓。",
      "15:50（美东）前平掉所有当日合约；新手优先 SPY、QQQ，少碰高波动个股。",
      "下列「跟单」由成交结构自动归纳，非投资建议；你需自行判断并承担风险。",
    ],
    summaries,
    disclaimer:
      "以上内容由系统根据延迟行情自动生成，仅供学习研究，不构成任何投资建议或收益承诺。",
  };
}
