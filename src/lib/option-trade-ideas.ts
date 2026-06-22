import { getUnderlying0DteData, type ExpiringOptionHighlight } from "@/lib/expiring-options";
import { formatOptionContractLabel } from "@/lib/option-copilot-scans";
import { fmt } from "@/lib/i18n/fmt";
import type { Dictionary } from "@/lib/i18n/zh";
import { thisFridayIso } from "@/lib/options-expiry";

export type TradeIdeasCopy = Dictionary["optionsPage"]["tradeIdeas"];

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

export type TradeIdeaConfidence = "high" | "medium" | "low";

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
  confidence: TradeIdeaConfidence;
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
  copy: TradeIdeasCopy,
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
    titleZh: copy.kindTitles.bull_put_spread,
    accent: "green",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: sell.strike - buy.strike,
    confidence: "medium",
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
  copy: TradeIdeasCopy,
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
    titleZh: copy.kindTitles.bear_call_spread,
    accent: "red",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: buy.strike - sell.strike,
    confidence: "medium",
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
  copy: TradeIdeasCopy,
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
    titleZh: copy.kindTitles.iron_condor,
    accent: "amber",
    expirationDate: exp,
    legs,
    netPremium: estimateNetPremium(legs, isCredit),
    isCredit,
    spreadWidth: w,
    confidence: "medium",
    flowScore: 0,
    flowNote: "",
    opsAlphaRec: "",
    rationale: "",
  };
}

function buildLongOption(
  c: ExpiringOptionHighlight,
  underlying: string,
  copy: TradeIdeasCopy,
): TradeIdea | null {
  const isCall = c.contractType === "call";
  const legs = [leg("buy", c)];
  return {
    id: `${underlying}-long-${c.contractType}-${c.strike}`,
    kind: isCall ? "long_call" : "long_put",
    title: isCall ? "Long Call" : "Long Put",
    titleZh: isCall ? copy.kindTitles.long_call : copy.kindTitles.long_put,
    accent: "blue",
    expirationDate: c.expirationDate,
    legs,
    netPremium: estimateNetPremium(legs, false),
    isCredit: false,
    spreadWidth: null,
    confidence: "medium",
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
  copy: TradeIdeasCopy,
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

  let confidence: TradeIdeaConfidence = "low";
  if (flowScore >= 75) confidence = "high";
  else if (flowScore >= 55) confidence = "medium";

  const flowNote =
    bias === "bullish"
      ? fmt(copy.flowBullishFmt, {
          call: (callVol / 1000).toFixed(1),
          put: (putVol / 1000).toFixed(1),
        })
      : bias === "bearish"
        ? copy.flowBearish
        : copy.flowNeutral;

  const prem =
    idea.netPremium != null
      ? idea.isCredit
        ? fmt(copy.premCreditFmt, { amount: idea.netPremium.toFixed(2) })
        : fmt(copy.premDebitFmt, { amount: Math.abs(idea.netPremium).toFixed(2) })
      : copy.premUnknown;

  const kindLabel = copy.kindTitles[idea.kind];
  const opsAlphaRec = `${idea.isCredit ? copy.opsRecCredit : copy.opsRecDebit} · ${kindLabel} · ${prem} · ${copy.opsRecSuffix}`;

  const rationale =
    idea.kind === "iron_condor"
      ? copy.rationaleIronCondor
      : idea.kind === "bull_put_spread"
        ? copy.rationaleBullPut
        : idea.kind === "bear_call_spread"
          ? copy.rationaleBearCall
          : copy.rationaleLong;

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
  copy: TradeIdeasCopy;
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
  const copy = opts.copy;

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
    const bps = buildBullPutSpread(puts, spot, expirationDate, symbol, copy);
    if (bps) raw.push(enrichIdea(bps, bias, callVol, putVol, copy));
  }
  if (bias === "bearish" || bias === "neutral") {
    const bcs = buildBearCallSpread(calls, spot, expirationDate, symbol, copy);
    if (bcs) raw.push(enrichIdea(bcs, bias, callVol, putVol, copy));
  }
  if (bias === "neutral") {
    const ic = buildIronCondor(puts, calls, spot, expirationDate, symbol, copy);
    if (ic) raw.push(enrichIdea(ic, bias, callVol, putVol, copy));
  }

  const atm =
    bias === "bullish"
      ? pickByStrike(calls, () => true, "nearSpot", spot)
      : bias === "bearish"
        ? pickByStrike(puts, () => true, "nearSpot", spot)
        : null;
  if (atm && atm.volume >= 500) {
    const lo = buildLongOption(atm, symbol, copy);
    if (lo) raw.push(enrichIdea(lo, bias, callVol, putVol, copy));
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

export function confidenceLabel(
  confidence: TradeIdeaConfidence,
  copy: TradeIdeasCopy,
): string {
  if (confidence === "high") return copy.confidenceHigh;
  if (confidence === "medium") return copy.confidenceMed;
  return copy.confidenceLow;
}
