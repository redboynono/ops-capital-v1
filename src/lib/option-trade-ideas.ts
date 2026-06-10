import { getUnderlying0DteData, type ExpiringOptionHighlight } from "@/lib/expiring-options";
import { formatOptionContractLabel } from "@/lib/option-copilot-scans";
import { thisFridayIso } from "@/lib/options-expiry";

export type IdeaLeg = {
  action: "buy" | "sell";
  contractType: "call" | "put";
  strike: number;
  expirationDate: string;
  label: string;
  volume: number;
  vwap: number | null;
};

export type TradeIdeaKind =
  | "bull_put_spread"
  | "bear_call_spread"
  | "iron_condor"
  | "long_call"
  | "long_put";

export type TradeIdea = {
  id: string;
  kind: TradeIdeaKind;
  title: string;
  titleZh: string;
  accent: "green" | "red" | "amber" | "blue";
  expirationDate: string;
  legs: IdeaLeg[];
  /** 预估净权利金（_CREDIT 为正）或净支出（DEBIT 为负） */
  netPremium: number | null;
  isCredit: boolean;
  spreadWidth: number | null;
  confidence: "高" | "中" | "低";
  flowScore: number;
  flowNote: string;
  opsAlphaRec: string;
  rationale: string;
};

function leg(
  action: "buy" | "sell",
  c: ExpiringOptionHighlight,
): IdeaLeg {
  return {
    action,
    contractType: c.contractType,
    strike: c.strike,
    expirationDate: c.expirationDate,
    label: formatOptionContractLabel(c.expirationDate, c.strike, c.contractType),
    volume: c.volume,
    vwap: c.vwap,
  };
}

function estimateNetPremium(legs: IdeaLeg[], isCredit: boolean): number | null {
  let sum = 0;
  let any = false;
  for (const l of legs) {
    if (l.vwap == null) continue;
    any = true;
    sum += l.action === "sell" ? l.vwap : -l.vwap;
  }
  if (!any) return null;
  return isCredit ? Math.max(0, sum) : Math.min(0, sum);
}

function pickByStrike(
  list: ExpiringOptionHighlight[],
  filter: (strike: number) => boolean,
  prefer: "volume" | "nearSpot",
  spot: number,
): ExpiringOptionHighlight | null {
  const pool = list.filter((c) => filter(c.strike) && c.volume > 0);
  if (pool.length === 0) return null;
  if (prefer === "volume") {
    return [...pool].sort((a, b) => b.volume - a.volume)[0] ?? null;
  }
  return [...pool].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0] ?? null;
}

function findStrikeNear(
  list: ExpiringOptionHighlight[],
  type: "call" | "put",
  target: number,
  direction: "above" | "below",
): ExpiringOptionHighlight | null {
  const pool = list.filter((c) => c.contractType === type);
  const sorted =
    direction === "above"
      ? pool.filter((c) => c.strike >= target).sort((a, b) => a.strike - b.strike)
      : pool.filter((c) => c.strike <= target).sort((a, b) => b.strike - a.strike);
  return sorted[0] ?? null;
}

function buildBullPutSpread(
  puts: ExpiringOptionHighlight[],
  spot: number,
  exp: string,
  underlying: string,
): TradeIdea | null {
  const sell = pickByStrike(puts, (k) => k < spot * 0.995 && k > spot * 0.9, "volume", spot);
  if (!sell) return null;
  const width = spot > 200 ? 10 : spot > 80 ? 5 : 2.5;
  const buy = findStrikeNear(puts, "put", sell.strike - width, "below");
  if (!buy || buy.strike >= sell.strike) return null;

  const legs = [leg("sell", sell), leg("buy", buy)];
  const isCredit = true;
  return {
    id: `${underlying}-bps-${sell.strike}`,
    kind: "bull_put_spread",
    title: "Bull Put Spread",
    titleZh: "牛市看跌价差",
    accent: "green",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: sell.strike - buy.strike,
    confidence: "中",
    flowScore: 0,
    flowNote: "",
    opsAlphaRec: "",
    rationale: "",
  };
}

function buildBearCallSpread(
  calls: ExpiringOptionHighlight[],
  spot: number,
  exp: string,
  underlying: string,
): TradeIdea | null {
  const sell = pickByStrike(calls, (k) => k > spot * 1.005 && k < spot * 1.12, "volume", spot);
  if (!sell) return null;
  const width = spot > 200 ? 10 : spot > 80 ? 5 : 2.5;
  const buy = findStrikeNear(calls, "call", sell.strike + width, "above");
  if (!buy || buy.strike <= sell.strike) return null;

  const legs = [leg("sell", sell), leg("buy", buy)];
  const isCredit = true;
  return {
    id: `${underlying}-bcs-${sell.strike}`,
    kind: "bear_call_spread",
    title: "Bear Call Spread",
    titleZh: "熊市看涨价差",
    accent: "red",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: buy.strike - sell.strike,
    confidence: "中",
    flowScore: 0,
    flowNote: "",
    opsAlphaRec: "",
    rationale: "",
  };
}

function buildIronCondor(
  puts: ExpiringOptionHighlight[],
  calls: ExpiringOptionHighlight[],
  spot: number,
  exp: string,
  underlying: string,
): TradeIdea | null {
  const sellPut = pickByStrike(puts, (k) => k < spot * 0.94 && k > spot * 0.85, "volume", spot);
  const sellCall = pickByStrike(calls, (k) => k > spot * 1.06 && k < spot * 1.15, "volume", spot);
  if (!sellPut || !sellCall) return null;
  const w = spot > 200 ? 10 : 5;
  const buyPut = findStrikeNear(puts, "put", sellPut.strike - w, "below");
  const buyCall = findStrikeNear(calls, "call", sellCall.strike + w, "above");
  if (!buyPut || !buyCall) return null;

  const legs = [leg("buy", buyPut), leg("sell", sellPut), leg("sell", sellCall), leg("buy", buyCall)];
  const isCredit = true;
  return {
    id: `${underlying}-ic`,
    kind: "iron_condor",
    title: "Iron Condor",
    titleZh: "铁鹰式（卖出波动）",
    accent: "amber",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: w,
    confidence: "中",
    flowScore: 0,
    flowNote: "",
    opsAlphaRec: "",
    rationale: "",
  };
}

function buildLongOption(
  c: ExpiringOptionHighlight,
  underlying: string,
): TradeIdea | null {
  const isCall = c.contractType === "call";
  const legs = [leg("buy", c)];
  return {
    id: `${underlying}-long-${c.contractType}-${c.strike}`,
    kind: isCall ? "long_call" : "long_put",
    title: isCall ? "Long Call" : "Long Put",
    titleZh: isCall ? "买入看涨" : "买入看跌",
    accent: "blue",
    expirationDate: c.expirationDate,
    legs,
    netPremium: estimateNetPremium(legs, false),
    isCredit: false,
    spreadWidth: null,
    confidence: "中",
    flowScore: 0,
    flowNote: "",
    opsAlphaRec: "",
    rationale: "",
  };
}

function enrichIdea(
  idea: TradeIdea,
  bias: "bullish" | "bearish" | "neutral",
  callVol: number,
  putVol: number,
): TradeIdea {
  const biasMatch =
    (idea.kind === "bull_put_spread" || idea.kind === "long_call") && bias === "bullish"
      ? 85
      : (idea.kind === "bear_call_spread" || idea.kind === "long_put") && bias === "bearish"
        ? 85
        : idea.kind === "iron_condor" && bias === "neutral"
          ? 80
          : 45;

  const volAtLegs = idea.legs.reduce((s, l) => s + l.volume, 0);
  const flowScore = Math.min(99, Math.round(biasMatch * 0.6 + Math.min(volAtLegs / 5000, 1) * 40));

  let confidence: TradeIdea["confidence"] = "低";
  if (flowScore >= 75) confidence = "高";
  else if (flowScore >= 55) confidence = "中";

  const flowNote =
    bias === "bullish"
      ? `Call 成交 ${(callVol / 1000).toFixed(1)}K vs Put ${(putVol / 1000).toFixed(1)}K`
      : bias === "bearish"
        ? `Put 成交偏多`
        : `多空均衡，适合区间策略`;

  const prem =
    idea.netPremium != null
      ? idea.isCredit
        ? `预估净收权利金约 $${idea.netPremium.toFixed(2)}`
        : `预估成本约 $${Math.abs(idea.netPremium).toFixed(2)}`
      : "权利金请以券商报价为准";

  const opsAlphaRec = `${idea.isCredit ? "卖出波动" : "买入方向"} · ${idea.titleZh} · ${prem} · 小仓+止损`;

  const rationale =
    idea.kind === "iron_condor"
      ? "价格在区间内震荡时收取权利金；突破区间需止损。"
      : idea.kind === "bull_put_spread"
        ? "看涨或横盘时卖出下方 Put 价差收权利金，风险为标的大跌。"
        : idea.kind === "bear_call_spread"
          ? "看跌或横盘时卖出上方 Call 价差，风险为标的大涨。"
          : "单腿方向押注，适合强趋势但时间价值衰减快。";

  return {
    ...idea,
    flowScore,
    flowNote,
    confidence,
    opsAlphaRec,
    rationale,
  };
}

export async function buildOptionTradeIdeas(opts: {
  symbol: string;
  expirationDate?: string;
  maxIdeas?: number;
}): Promise<{
  symbol: string;
  expirationDate: string;
  spot: number | null;
  bias: "bullish" | "bearish" | "neutral";
  ideas: TradeIdea[];
}> {
  const symbol = opts.symbol.trim().toUpperCase();
  const expirationDate = opts.expirationDate ?? thisFridayIso();
  const maxIdeas = opts.maxIdeas ?? 3;

  const { contracts, summary } = await getUnderlying0DteData(symbol, expirationDate);
  const spot = summary?.underlyingPrice ?? contracts[0]?.underlyingPrice ?? null;
  const bias = summary?.bias ?? "neutral";
  const callVol = summary?.callVolume ?? 0;
  const putVol = summary?.putVolume ?? 0;

  if (!spot || contracts.length < 4) {
    return { symbol, expirationDate, spot, bias, ideas: [] };
  }

  const puts = contracts.filter((c) => c.contractType === "put");
  const calls = contracts.filter((c) => c.contractType === "call");

  const raw: TradeIdea[] = [];

  if (bias === "bullish" || bias === "neutral") {
    const bps = buildBullPutSpread(puts, spot, expirationDate, symbol);
    if (bps) raw.push(enrichIdea(bps, bias, callVol, putVol));
  }
  if (bias === "bearish" || bias === "neutral") {
    const bcs = buildBearCallSpread(calls, spot, expirationDate, symbol);
    if (bcs) raw.push(enrichIdea(bcs, bias, callVol, putVol));
  }
  if (bias === "neutral") {
    const ic = buildIronCondor(puts, calls, spot, expirationDate, symbol);
    if (ic) raw.push(enrichIdea(ic, bias, callVol, putVol));
  }

  const atm =
    bias === "bullish"
      ? pickByStrike(calls, () => true, "nearSpot", spot)
      : bias === "bearish"
        ? pickByStrike(puts, () => true, "nearSpot", spot)
        : null;
  if (atm && atm.volume >= 500) {
    const lo = buildLongOption(atm, symbol);
    if (lo) raw.push(enrichIdea(lo, bias, callVol, putVol));
  }

  const byKind = new Map<string, TradeIdea>();
  for (const idea of raw.sort((a, b) => b.flowScore - a.flowScore)) {
    if (!byKind.has(idea.kind)) byKind.set(idea.kind, idea);
  }

  const ideas = [...byKind.values()]
    .sort((a, b) => b.flowScore - a.flowScore)
    .slice(0, maxIdeas);

  return { symbol, expirationDate, spot, bias, ideas };
}
