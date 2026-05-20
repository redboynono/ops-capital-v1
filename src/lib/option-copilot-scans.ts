import {
  listExpiringOptionsRadar,
  type ExpiringOptionHighlight,
} from "@/lib/expiring-options";

export type CopilotDirectRow = {
  underlying: string;
  optionLabel: string;
  contractType: "call" | "put";
  strike: number;
  expirationDate: string;
  volume: number;
  pctOfTotal: number | null;
  vwap: number | null;
  actionHint: string;
  /** OPS Alpha 跟单推荐（面向用户的一行操作） */
  opsAlphaRec: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatOptionContractLabel(
  expirationDate: string,
  strike: number,
  contractType: "call" | "put",
): string {
  const [y, m, d] = expirationDate.split("-").map(Number);
  const mon = MONTHS[m - 1] ?? "???";
  const type = contractType === "call" ? "C" : "P";
  return `${d}-${mon}-${y} ${strike} ${type}`;
}

function concentrationHint(c: ExpiringOptionHighlight, pct: number): string {
  const side = c.contractType === "call" ? "看涨" : "看跌";
  if (pct >= 70) {
    return `→ 成交高度集中，可优先跟踪该张 ${side}（占全链 ${pct.toFixed(1)}%）`;
  }
  return `→ 成交偏多在此合约，关注 ${side} 方向（占全链 ${pct.toFixed(1)}%）`;
}

function buySideHint(c: ExpiringOptionHighlight): string {
  const chg = c.dayChangePct ?? 0;
  if (c.contractType === "call") {
    return chg > 0
      ? `→ 买盘推升 Call（+${chg.toFixed(1)}%），倾向轻仓跟涨`
      : `→ Call 放量，结合现价自行判断方向`;
  }
  return chg > 0
    ? `→ 买盘推升 Put（+${chg.toFixed(1)}%），倾向轻仓跟跌/对冲`
    : `→ Put 放量，结合现价自行判断方向`;
}

function opsAlphaRecommendation(
  c: ExpiringOptionHighlight,
  kind: "concentration" | "buySide",
  pct?: number,
): string {
  const exp = c.expirationDate;
  const k = c.strike;
  if (c.contractType === "call") {
    if (kind === "concentration" && pct != null) {
      return `买入 Call ${k}（到期 ${exp}）· 成交占全链 ${pct.toFixed(0)}% · 轻仓跟涨`;
    }
    const chg = c.dayChangePct ?? 0;
    return chg > 0
      ? `买入 Call ${k} · 跟涨 · 小仓 + 止损`
      : `关注 Call ${k} · 放量但未大涨 · 观望或极小仓试多`;
  }
  if (kind === "concentration" && pct != null) {
    return `买入 Put ${k}（到期 ${exp}）· 成交占全链 ${pct.toFixed(0)}% · 轻仓跟跌/对冲`;
  }
  const chg = c.dayChangePct ?? 0;
  return chg > 0
    ? `买入 Put ${k} · 跟跌或对冲 · 小仓 + 止损`
    : `关注 Put ${k} · 放量但未大跌 · 观望或极小仓试空`;
}

function toRow(
  c: ExpiringOptionHighlight,
  pctOfTotal: number | null,
  actionHint: string,
  kind: "concentration" | "buySide",
): CopilotDirectRow {
  return {
    underlying: c.underlying,
    optionLabel: formatOptionContractLabel(c.expirationDate, c.strike, c.contractType),
    contractType: c.contractType,
    strike: c.strike,
    expirationDate: c.expirationDate,
    volume: c.volume,
    pctOfTotal,
    vwap: c.vwap,
    actionHint,
    opsAlphaRec: opsAlphaRecommendation(c, kind, pctOfTotal ?? undefined),
  };
}

export async function buildCopilotDirectSignals(opts: {
  expirationDate: string;
  symbol?: string;
  limit?: number;
}): Promise<{
  concentration: CopilotDirectRow[];
  buySide: CopilotDirectRow[];
}> {
  const limit = opts.limit ?? 12;
  const symbol = opts.symbol?.trim().toUpperCase();

  const { byUnderlying } = await listExpiringOptionsRadar({
    expirationDate: opts.expirationDate,
    topPerUnderlying: 120,
    globalLimit: 200,
    underlyings: symbol ? [symbol] : undefined,
  });

  const keys = symbol ? [symbol] : Object.keys(byUnderlying);
  const concentration: CopilotDirectRow[] = [];
  const buySide: CopilotDirectRow[] = [];

  for (const u of keys) {
    const contracts = byUnderlying[u] ?? [];
    if (contracts.length === 0) continue;

    const totalVol = contracts.reduce((s, c) => s + c.volume, 0);
    if (totalVol <= 0) continue;

    const top = [...contracts].sort((a, b) => b.volume - a.volume)[0];
    if (top && top.volume >= 200) {
      const pct = (top.volume / totalVol) * 100;
      if (pct >= 35) {
        concentration.push(toRow(top, pct, concentrationHint(top, pct), "concentration"));
      }
    }

    for (const c of contracts) {
      if (c.volume < 300) continue;
      const volOi = c.volumeOiRatio ?? 0;
      const chg = c.dayChangePct ?? 0;
      if (chg > 0 || volOi >= 1) {
        buySide.push(toRow(c, null, buySideHint(c), "buySide"));
      }
    }
  }

  concentration.sort((a, b) => (b.pctOfTotal ?? 0) - (a.pctOfTotal ?? 0));
  const seen = new Set<string>();
  const dedupedBuy = buySide.filter((r) => {
    const k = `${r.underlying}:${r.optionLabel}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  dedupedBuy.sort((a, b) => b.volume - a.volume);

  return {
    concentration: concentration.slice(0, limit),
    buySide: dedupedBuy.slice(0, limit),
  };
}
