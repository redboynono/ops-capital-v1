import {
  getUnderlying0DteData,
  listExpiringOptionsRadar,
  normalizeUsTickerInput,
  type ExpiringOptionHighlight,
  type Underlying0DteSummary,
} from "@/lib/expiring-options";
import { fmt } from "@/lib/i18n/fmt";
import type { Dictionary } from "@/lib/i18n/zh";
import { isUsEquityTicker } from "@/lib/polygon";

export type PlaybookCopy = Dictionary["optionsPage"]["playbook"];

export type PlayBias = "bullish" | "bearish" | "neutral";
export type PlayAction = "long" | "short" | "watch";
export type PlayConfidence = "high" | "medium" | "low";

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
  followPicks: FollowLeg[];
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
  if (bias === "bullish") return "long";
  if (bias === "bearish") return "short";
  return "watch";
}

function confidenceFromVol(total: number, bias: PlayBias): PlayConfidence {
  if (bias === "neutral") return "low";
  if (total >= 50_000) return "high";
  if (total >= 8_000) return "medium";
  return "low";
}

function flowText(bias: PlayBias, copy: PlaybookCopy): string {
  if (bias === "bullish") return copy.flowCallHeavy;
  if (bias === "bearish") return copy.flowPutHeavy;
  return copy.flowUnclear;
}

function actionWord(action: PlayAction, copy: PlaybookCopy): string {
  if (action === "long") return copy.actionLong;
  if (action === "short") return copy.actionShort;
  return copy.actionWatch;
}

function buildHeadline(
  u: string,
  action: PlayAction,
  bias: PlayBias,
  copy: PlaybookCopy,
): string {
  const flow = flowText(bias, copy);
  if (action === "watch") {
    return fmt(copy.headlineWatchFmt, { symbol: u, flow });
  }
  return fmt(copy.headlineActionFmt, { symbol: u, flow, action: actionWord(action, copy) });
}

function buildSteps(action: PlayAction, leg: FollowLeg, copy: PlaybookCopy): string[] {
  const sym = leg.underlying;
  const typeLabel = leg.contractType === "call" ? copy.contractCall : copy.contractPut;
  const strike = String(leg.strike);
  const exp = `${leg.expirationDate} (${leg.expiryLabel})`;

  if (action === "watch") {
    return [
      fmt(copy.stepWatch1, { sym, exp }),
      copy.stepWatch2,
      fmt(copy.stepWatch3, { expiryDate: leg.expirationDate }),
    ];
  }

  return [
    fmt(copy.stepTrade1, { sym, exp, type: typeLabel, strike, moneyness: leg.moneyness }),
    copy.stepTrade2,
    fmt(copy.stepTrade3, { expiryDate: leg.expirationDate }),
  ];
}

function legFromSummary(
  s: Underlying0DteSummary,
  contracts: ExpiringOptionHighlight[],
  meta: { expirationDate: string; expiryLabel: string },
  copy: PlaybookCopy,
): FollowLeg | null {
  const action = actionLabel(s.bias);
  const spot = s.underlyingPrice;
  const contract =
    s.bias === "bullish"
      ? pickNearAtm(contracts, "call", spot)
      : s.bias === "bearish"
        ? pickNearAtm(contracts, "put", spot)
        : null;

  if (action === "watch" || !contract) {
    if (s.totalVolume < MIN_TOTAL_VOL) return null;
    const leg: FollowLeg = {
      underlying: s.underlying,
      action: "watch",
      bias: s.bias,
      confidence: "low",
      headline: buildHeadline(s.underlying, "watch", s.bias, copy),
      contractType: "call",
      strike: spot ?? 0,
      underlyingPrice: spot,
      volume: 0,
      moneyness: "ATM",
      expirationDate: meta.expirationDate,
      expiryLabel: meta.expiryLabel,
      steps: [],
      riskNote: copy.riskUnclear,
    };
    leg.steps = buildSteps("watch", leg, copy);
    return leg;
  }

  const conf = confidenceFromVol(s.totalVolume, s.bias);
  const leg: FollowLeg = {
    underlying: s.underlying,
    action,
    bias: s.bias,
    confidence: conf,
    headline: buildHeadline(s.underlying, action, s.bias, copy),
    contractType: contract.contractType,
    strike: contract.strike,
    underlyingPrice: spot,
    volume: contract.volume,
    moneyness: moneyness(contract.contractType, contract.strike, spot),
    expirationDate: meta.expirationDate,
    expiryLabel: meta.expiryLabel,
    steps: [],
    riskNote: INDEX_FIRST.has(s.underlying) ? copy.riskIndex : copy.riskSingle,
  };
  leg.steps = buildSteps(action, leg, copy);
  return leg;
}

function marketMoodText(
  summaries: Underlying0DteSummary[],
  expiryLabel: string,
  copy: PlaybookCopy,
): string {
  const idx = summaries.filter((s) => INDEX_FIRST.has(s.underlying) && s.totalVolume >= MIN_TOTAL_VOL);
  const bull = idx.filter((s) => s.bias === "bullish").length;
  const bear = idx.filter((s) => s.bias === "bearish").length;
  if (idx.length === 0) return fmt(copy.moodThinFmt, { label: expiryLabel });
  if (bull >= 2 && bear === 0) return copy.moodBullIndex;
  if (bear >= 2 && bull === 0) return copy.moodBearIndex;
  if (bull > bear) return copy.moodBullMix;
  if (bear > bull) return copy.moodBearMix;
  return copy.moodNeutral;
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

function flowNoteFromSummary(s: Underlying0DteSummary, copy: PlaybookCopy): string {
  const ratio =
    s.putVolume > 0 ? (s.callVolume / s.putVolume).toFixed(2) : s.callVolume > 0 ? "∞" : "—";
  return fmt(copy.flowNoteFmt, {
    call: fmtVol(s.callVolume),
    put: fmtVol(s.putVolume),
    ratio,
  });
}

export async function buildSymbolExpiringOptionsPlaybook(
  rawSymbol: string,
  copy: PlaybookCopy,
  expirationDate?: string,
  expiryLabel = "This Fri",
): Promise<SymbolPlaybookResult> {
  const symbol = normalizeUsTickerInput(rawSymbol);
  if (!symbol) {
    return { status: "error", symbol: "", message: copy.errEmptySymbol };
  }
  if (!isUsEquityTicker(symbol)) {
    return { status: "error", symbol, message: copy.errUsOnly };
  }

  if (!process.env.POLYGON_API_KEY) {
    return { status: "error", symbol, message: copy.errQuotesDown };
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
      message: fmt(copy.errNoDataFmt, { symbol, date: resolvedExp, label: expiryLabel }),
    };
  }

  const meta = { expirationDate: resolvedExp, expiryLabel };
  const pick =
    legFromSummary(summary, contracts, meta, copy) ??
    ({
      underlying: symbol,
      action: "watch" as const,
      bias: summary.bias,
      confidence: "low" as const,
      headline: buildHeadline(symbol, "watch", summary.bias, copy),
      contractType: "call" as const,
      strike: summary.underlyingPrice ?? 0,
      underlyingPrice: summary.underlyingPrice,
      volume: 0,
      moneyness: "ATM" as const,
      expirationDate: resolvedExp,
      expiryLabel,
      steps: [],
      riskNote: copy.riskLowVol,
    } satisfies FollowLeg);
  pick.steps = buildSteps(pick.action, pick, copy);

  return {
    status: "ok",
    symbol,
    expirationDate: resolvedExp,
    expiryLabel,
    summary,
    pick,
    flowNote: flowNoteFromSummary(summary, copy),
  };
}

export async function buildTodayExpiringOptionsPlaybook(
  expirationDate: string | undefined,
  expiryLabel: string,
  copy: PlaybookCopy,
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
    const leg = legFromSummary(s, contracts, { expirationDate: exp, expiryLabel }, copy);
    if (!leg) continue;
    if (leg.action === "watch" && !INDEX_FIRST.has(s.underlying)) continue;
    followPicks.push(leg);
  }

  if (followPicks.length === 0 && ranked.length > 0) {
    const s = ranked[0];
    const leg = legFromSummary(s, byUnderlying[s.underlying] ?? [], {
      expirationDate: exp,
      expiryLabel,
    }, copy);
    if (leg) followPicks.push(leg);
  }

  return {
    expirationDate: exp,
    marketMood: marketMoodText(summaries, expiryLabel, copy),
    followPicks,
    discipline: [...copy.discipline],
    summaries,
    disclaimer: copy.disclaimer,
  };
}
