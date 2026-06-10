import {
  getUnderlying0DteData,
  listExpiringOptionsRadar,
  normalizeUsTickerInput,
  type ExpiringOptionHighlight,
  type Underlying0DteSummary,
} from "@/lib/expiring-options";
import { isUsEquityTicker } from "@/lib/polygon";

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
  expirationDate: string;
  expiryLabel: string;
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
  const exp = `${leg.expirationDate}（${leg.expiryLabel}）`;

  if (action === "观望") {
    return [
      `${sym} 在 ${exp} 到期合约上方向不明，暂不新开仓；可改看 SPY/QQQ 或切换「下周五」。`,
      "若已持仓：设定止损，14:30 后不加仓。",
      `到期日 ${leg.expirationDate} 前一日或到期日当天早盘完成平仓，勿拖到过久。`,
    ];
  }

  return [
    `在券商搜索 ${sym}、到期日为 ${exp} 的 ${typeZh}，行权价 ${strike}（${leg.moneyness}）。`,
    `仅用小仓位试单（建议 ≤ 可承受亏损资金的 3%），成交后立刻设止损。`,
    `越临近 ${leg.expirationDate}，时间价值衰减越快；14:30 后慎开新仓，到期前务必了结。`,
  ];
}

function legFromSummary(
  s: Underlying0DteSummary,
  contracts: ExpiringOptionHighlight[],
  meta: { expirationDate: string; expiryLabel: string },
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
    const leg: FollowLeg = {
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
      expirationDate: meta.expirationDate,
      expiryLabel: meta.expiryLabel,
      steps: [],
      riskNote: "方向不明时不宜强行跟单。",
    };
    leg.steps = buildSteps("观望", leg);
    return leg;
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
    expirationDate: meta.expirationDate,
    expiryLabel: meta.expiryLabel,
    steps: [],
    riskNote:
      INDEX_FIRST.has(s.underlying)
        ? "指数流动性好，但仍可能全天归零，务必小仓+止损。"
        : "个股波动更大，新手优先 SPY/QQQ，勿重仓单票。",
  };
  leg.steps = buildSteps(action, leg);
  return leg;
}

function marketMoodText(summaries: Underlying0DteSummary[], expiryLabel: string): string {
  const idx = summaries.filter((s) => INDEX_FIRST.has(s.underlying) && s.totalVolume >= MIN_TOTAL_VOL);
  const bull = idx.filter((s) => s.bias === "bullish").length;
  const bear = idx.filter((s) => s.bias === "bearish").length;
  if (idx.length === 0)
    return `${expiryLabel}到期合约成交偏淡，整体宜降低仓位、以观望为主。`;
  if (bull >= 2 && bear === 0) return "宽基指数（SPY/QQQ/IWM）成交偏多在上游 Call，大盘情绪偏暖，可轻仓跟涨但严守止损。";
  if (bear >= 2 && bull === 0) return "宽基指数成交偏多在上游 Put，情绪偏谨慎，可轻仓跟跌或观望，勿逆势重仓。";
  if (bull > bear) return "指数多空交织但略偏多，优先跟 SPY/QQQ 的 Call 方向，个股期权次之。";
  if (bear > bull) return "指数多空交织但略偏空，优先跟 SPY/QQQ 的 Put 方向或观望。";
  return "指数多空成交接近，今日以震荡思路对待，减小仓位、缩短持仓时间。";
}

export type SymbolPlaybookResult =
  | {
      status: "ok";
      symbol: string;
      expirationDate: string;
      expiryLabel: string;
      summary: Underlying0DteSummary;
      pick: FollowLeg;
      flowNote: string;
    }
  | { status: "error"; symbol: string; message: string };

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function flowNoteFromSummary(s: Underlying0DteSummary): string {
  const ratio =
    s.putVolume > 0 ? (s.callVolume / s.putVolume).toFixed(2) : s.callVolume > 0 ? "∞" : "—";
  return `Call 成交 ${fmtVol(s.callVolume)} · Put 成交 ${fmtVol(s.putVolume)} · Call/Put 比 ${ratio}`;
}

export async function buildSymbolExpiringOptionsPlaybook(
  rawSymbol: string,
  expirationDate?: string,
  expiryLabel = "本周五",
): Promise<SymbolPlaybookResult> {
  const symbol = normalizeUsTickerInput(rawSymbol);
  if (!symbol) {
    return { status: "error", symbol: "", message: "请输入股票代码，例如 NVDA、SPY。" };
  }
  if (!isUsEquityTicker(symbol)) {
    return {
      status: "error",
      symbol,
      message: "暂仅支持美股代码（如 NVDA、SPY）。港股、指数、加密货币请使用其他工具。",
    };
  }

  if (!process.env.POLYGON_API_KEY) {
    return { status: "error", symbol, message: "行情服务暂不可用，请稍后再试。" };
  }

  const exp = expirationDate;
  const { expirationDate: resolvedExp, contracts, summary } = await getUnderlying0DteData(
    symbol,
    exp,
  );

  if (!summary || contracts.length === 0) {
    return {
      status: "error",
      symbol,
      message: `${symbol} 在 ${resolvedExp}（${expiryLabel}）暂无成交数据。可切换「下周五」或改试 SPY、QQQ。`,
    };
  }

  const meta = { expirationDate: resolvedExp, expiryLabel };
  const pick =
    legFromSummary(summary, contracts, meta) ??
    ({
      underlying: symbol,
      action: "观望" as const,
      bias: summary.bias,
      confidence: "低" as const,
      headline: buildHeadline(symbol, "观望", summary.bias, summary.totalVolume),
      contractType: "call" as const,
      strike: summary.underlyingPrice ?? 0,
      underlyingPrice: summary.underlyingPrice,
      volume: 0,
      moneyness: "ATM" as const,
      expirationDate: resolvedExp,
      expiryLabel,
      steps: [],
      riskNote: "成交偏低，不建议强行跟单。",
    } satisfies FollowLeg);
  pick.steps = buildSteps(pick.action, pick);

  return {
    status: "ok",
    symbol,
    expirationDate: resolvedExp,
    expiryLabel,
    summary,
    pick,
    flowNote: flowNoteFromSummary(summary),
  };
}

export async function buildTodayExpiringOptionsPlaybook(
  expirationDate?: string,
  expiryLabel = "本周五",
): Promise<TodayExpiringOptionsPlaybook> {
  const { expirationDate: exp, summaries, byUnderlying } = await listExpiringOptionsRadar({
    expirationDate,
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
    const leg = legFromSummary(s, contracts, { expirationDate: exp, expiryLabel });
    if (!leg) continue;
    if (leg.action === "观望" && !INDEX_FIRST.has(s.underlying)) continue;
    followPicks.push(leg);
  }

  if (followPicks.length === 0 && ranked.length > 0) {
    const s = ranked[0];
    const leg = legFromSummary(s, byUnderlying[s.underlying] ?? [], {
      expirationDate: exp,
      expiryLabel,
    });
    if (leg) followPicks.push(leg);
  }

  return {
    expirationDate: exp,
    marketMood: marketMoodText(summaries, expiryLabel),
    followPicks,
    discipline: [
      "临近到期期权（如本周五/下周五）时间价值衰减快，错方向可能本金大幅亏损，仅用闲钱。",
      "单笔投入建议 ≤ 总资金的 3%，且必须设止损；14:30 后不再新开仓。",
      "在到期日当日或前一日完成平仓；新手优先 SPY、QQQ，个股波动更大。",
      "下列「跟单」由成交结构自动归纳，非投资建议；你需自行判断并承担风险。",
    ],
    summaries,
    disclaimer:
      "以上内容由系统根据延迟行情自动生成，仅供学习研究，不构成任何投资建议或收益承诺。",
  };
}
