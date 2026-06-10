import type { IdeaLeg, TradeIdea, TradeIdeaKind } from "@/lib/option-trade-ideas";

/** 到期日按标的价格 S 的每份合约盈亏（美元/股），含开仓净权利金。 */
export function payoffAtPrice(
  stockPrice: number,
  legs: IdeaLeg[],
  netPremium: number | null,
): number {
  let intrinsic = 0;
  for (const l of legs) {
    const sign = l.action === "buy" ? 1 : -1;
    if (l.contractType === "call") {
      intrinsic += sign * Math.max(0, stockPrice - l.strike);
    } else {
      intrinsic += sign * Math.max(0, l.strike - stockPrice);
    }
  }
  return intrinsic + (netPremium ?? 0);
}

export type IdeaPayoffAnalysis = {
  kind: TradeIdeaKind;
  spot: number | null;
  netPremium: number | null;
  isCredit: boolean;
  /** 盈亏平衡标的价格（可能 0–2 个） */
  breakevens: number[];
  maxGain: number | null;
  maxLoss: number | null;
  /** 现价至最近上行风险边界的距离 %（credit 策略为「上方缓冲」） */
  cushionUpPct: number | null;
  /** 现价至最近下行风险边界的距离 % */
  cushionDownPct: number | null;
  /** 到期盈亏曲线采样 */
  curve: { price: number; pl: number }[];
  priceMin: number;
  priceMax: number;
  plMin: number;
  plMax: number;
};

function sortedStrikes(legs: IdeaLeg[], type: "call" | "put"): number[] {
  return legs
    .filter((l) => l.contractType === type)
    .map((l) => l.strike)
    .sort((a, b) => a - b);
}

function sampleCurve(
  legs: IdeaLeg[],
  netPremium: number | null,
  center: number,
  spanPct: number,
  steps = 80,
): { curve: { price: number; pl: number }[]; priceMin: number; priceMax: number; plMin: number; plMax: number } {
  const strikes = legs.map((l) => l.strike);
  const loStrike = Math.min(...strikes, center);
  const hiStrike = Math.max(...strikes, center);
  const span = Math.max(center * spanPct, hiStrike - loStrike + 20, 8);
  const priceMin = Math.max(0.01, Math.min(loStrike, center) - span * 0.35);
  const priceMax = Math.max(hiStrike, center) + span * 0.35;
  const curve: { price: number; pl: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const price = priceMin + ((priceMax - priceMin) * i) / steps;
    curve.push({ price, pl: payoffAtPrice(price, legs, netPremium) });
  }
  const pls = curve.map((p) => p.pl);
  return {
    curve,
    priceMin,
    priceMax,
    plMin: Math.min(...pls),
    plMax: Math.max(...pls),
  };
}

function findBreakevens(
  legs: IdeaLeg[],
  netPremium: number | null,
  priceMin: number,
  priceMax: number,
): number[] {
  const steps = 400;
  const roots: number[] = [];
  let prevPl = payoffAtPrice(priceMin, legs, netPremium);
  for (let i = 1; i <= steps; i++) {
    const price = priceMin + ((priceMax - priceMin) * i) / steps;
    const pl = payoffAtPrice(price, legs, netPremium);
    if (prevPl === 0) roots.push(priceMin + ((priceMax - priceMin) * (i - 1)) / steps);
    if (pl === 0) roots.push(price);
    else if ((prevPl < 0 && pl > 0) || (prevPl > 0 && pl < 0)) {
      let lo = priceMin + ((priceMax - priceMin) * (i - 1)) / steps;
      let hi = price;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        const midPl = payoffAtPrice(mid, legs, netPremium);
        if (Math.abs(midPl) < 1e-6) {
          roots.push(mid);
          break;
        }
        if ((prevPl < 0 && midPl < 0) || (prevPl > 0 && midPl > 0)) lo = mid;
        else hi = mid;
      }
      roots.push((lo + hi) / 2);
    }
    prevPl = pl;
  }
  const deduped: number[] = [];
  for (const r of roots) {
    if (!deduped.some((x) => Math.abs(x - r) < 0.02)) deduped.push(r);
  }
  return deduped.sort((a, b) => a - b);
}

function analyticMetrics(
  idea: TradeIdea,
  spot: number | null,
): Pick<
  IdeaPayoffAnalysis,
  "breakevens" | "maxGain" | "maxLoss" | "cushionUpPct" | "cushionDownPct"
> {
  const C = idea.netPremium ?? 0;
  const credit = idea.isCredit ? Math.max(0, C) : 0;
  const debit = idea.isCredit ? 0 : Math.abs(idea.netPremium ?? 0);

  switch (idea.kind) {
    case "bull_put_spread": {
      const puts = sortedStrikes(idea.legs, "put");
      const K_low = puts[0];
      const K_high = puts[puts.length - 1];
      const width = K_high - K_low;
      const maxGain = credit || null;
      const maxLoss = width > credit ? -(width - credit) : null;
      const be = K_high - credit;
      const cushionDown =
        spot != null && be < spot ? ((spot - be) / spot) * 100 : null;
      const cushionUp = spot != null ? ((K_high - spot) / spot) * 100 : null;
      return {
        breakevens: [be],
        maxGain,
        maxLoss,
        cushionUpPct: cushionUp,
        cushionDownPct: cushionDown,
      };
    }
    case "bear_call_spread": {
      const calls = sortedStrikes(idea.legs, "call");
      const K_low = calls[0];
      const K_high = calls[calls.length - 1];
      const width = K_high - K_low;
      const maxGain = credit || null;
      const maxLoss = -(width - credit);
      const be = K_low + credit;
      const cushionUp =
        spot != null && be > spot ? ((be - spot) / spot) * 100 : null;
      const cushionDown = spot != null ? ((spot - K_low) / spot) * 100 : null;
      return {
        breakevens: [be],
        maxGain,
        maxLoss,
        cushionUpPct: cushionUp,
        cushionDownPct: cushionDown,
      };
    }
    case "iron_condor": {
      const puts = sortedStrikes(idea.legs, "put");
      const calls = sortedStrikes(idea.legs, "call");
      const putWing = puts[0];
      const shortPut = puts[1] ?? puts[0];
      const shortCall = calls[0] ?? calls[calls.length - 1];
      const callWing = calls[calls.length - 1];
      const wingW = Math.max(shortPut - putWing, callWing - shortCall, idea.spreadWidth ?? 5);
      const maxGain = credit || null;
      const maxLoss = -(wingW - credit);
      return {
        breakevens: [shortPut - credit, shortCall + credit],
        maxGain,
        maxLoss,
        cushionUpPct:
          spot != null ? ((shortCall + credit - spot) / spot) * 100 : null,
        cushionDownPct:
          spot != null ? ((spot - (shortPut - credit)) / spot) * 100 : null,
      };
    }
    case "long_call": {
      const K = idea.legs[0]?.strike ?? 0;
      const be = K + debit;
      return {
        breakevens: [be],
        maxGain: null,
        maxLoss: debit ? -debit : null,
        cushionUpPct: spot != null ? ((be - spot) / spot) * 100 : null,
        cushionDownPct: spot != null ? ((spot - K) / spot) * 100 : null,
      };
    }
    case "long_put": {
      const K = idea.legs[0]?.strike ?? 0;
      const be = K - debit;
      return {
        breakevens: [be],
        maxGain: K - debit,
        maxLoss: debit ? -debit : null,
        cushionUpPct: spot != null ? ((K - spot) / spot) * 100 : null,
        cushionDownPct: spot != null ? ((spot - be) / spot) * 100 : null,
      };
    }
    default:
      return {
        breakevens: [],
        maxGain: null,
        maxLoss: null,
        cushionUpPct: null,
        cushionDownPct: null,
      };
  }
}

export function analyzeIdeaPayoff(idea: TradeIdea, spot: number | null): IdeaPayoffAnalysis {
  const center =
    spot ??
    idea.legs.reduce((s, l) => s + l.strike, 0) / Math.max(idea.legs.length, 1);
  const spanPct = idea.kind === "long_call" || idea.kind === "long_put" ? 0.22 : 0.14;
  const { curve, priceMin, priceMax, plMin, plMax } = sampleCurve(
    idea.legs,
    idea.netPremium,
    center,
    spanPct,
  );
  const breakevens = findBreakevens(idea.legs, idea.netPremium, priceMin, priceMax);
  const analytic = analyticMetrics(idea, spot);

  return {
    kind: idea.kind,
    spot,
    netPremium: idea.netPremium,
    isCredit: idea.isCredit,
    breakevens: breakevens.length ? breakevens : analytic.breakevens,
    maxGain: analytic.maxGain ?? plMax,
    maxLoss: analytic.maxLoss ?? plMin,
    cushionUpPct: analytic.cushionUpPct,
    cushionDownPct: analytic.cushionDownPct,
    curve,
    priceMin,
    priceMax,
    plMin: Math.min(plMin, analytic.maxLoss ?? plMin),
    plMax: Math.max(plMax, analytic.maxGain ?? plMax),
  };
}
