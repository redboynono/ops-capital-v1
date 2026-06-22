import {
  listExpiringOptionsRadar,
  type ExpiringOptionHighlight,
} from "@/lib/expiring-options";
import { fmt } from "@/lib/i18n/fmt";
import type { Dictionary } from "@/lib/i18n/zh";

export type CopilotCopy = Dictionary["options"]["copilot"];

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

function concentrationHint(c: ExpiringOptionHighlight, pct: number, copy: CopilotCopy): string {
  const side = c.contractType === "call" ? copy.sideCall : copy.sidePut;
  const pctStr = pct.toFixed(1);
  if (pct >= 70) {
    return fmt(copy.concentrationHigh, { side, pct: pctStr });
  }
  return fmt(copy.concentrationMed, { side, pct: pctStr });
}

function buySideHint(c: ExpiringOptionHighlight, copy: CopilotCopy): string {
  const chg = c.dayChangePct ?? 0;
  const chgStr = chg.toFixed(1);
  if (c.contractType === "call") {
    return chg > 0 ? fmt(copy.buySideCallUp, { chg: chgStr }) : copy.buySideCallVol;
  }
  return chg > 0 ? fmt(copy.buySidePutUp, { chg: chgStr }) : copy.buySidePutVol;
}

function opsAlphaRecommendation(
  c: ExpiringOptionHighlight,
  kind: "concentration" | "buySide",
  copy: CopilotCopy,
  pct?: number,
): string {
  const exp = c.expirationDate;
  const k = c.strike;
  if (c.contractType === "call") {
    if (kind === "concentration" && pct != null) {
      return fmt(copy.recBuyCallConc, { strike: k, exp, pct: pct.toFixed(0) });
    }
    const chg = c.dayChangePct ?? 0;
    return chg > 0 ? fmt(copy.recBuyCallUp, { strike: k }) : fmt(copy.recWatchCall, { strike: k });
  }
  if (kind === "concentration" && pct != null) {
    return fmt(copy.recBuyPutConc, { strike: k, exp, pct: pct.toFixed(0) });
  }
  const chg = c.dayChangePct ?? 0;
  return chg > 0 ? fmt(copy.recBuyPutUp, { strike: k }) : fmt(copy.recWatchPut, { strike: k });
}

function toRow(
  c: ExpiringOptionHighlight,
  pctOfTotal: number | null,
  actionHint: string,
  kind: "concentration" | "buySide",
  copy: CopilotCopy,
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
    opsAlphaRec: opsAlphaRecommendation(c, kind, copy, pctOfTotal ?? undefined),
  };
}

export async function buildCopilotDirectSignals(opts: {
  expirationDate: string;
  symbol?: string;
  /** 未指定 symbol 时扫描的标的列表；默认全 watchlist */
  underlyings?: readonly string[];
  limit?: number;
  copy: CopilotCopy;
}): Promise<{
  concentration: CopilotDirectRow[];
  buySide: CopilotDirectRow[];
}> {
  const limit = opts.limit ?? 12;
  const copy = opts.copy;
  const symbol = opts.symbol?.trim().toUpperCase();
  const underlyingList = symbol
    ? [symbol]
    : opts.underlyings?.length
      ? [...opts.underlyings]
      : undefined;
  const scanCount = underlyingList?.length ?? 12;
  const topPerUnderlying = scanCount <= 2 ? 40 : scanCount <= 4 ? 60 : 120;
  const globalLimit = scanCount <= 2 ? 60 : scanCount <= 4 ? 120 : 200;

  const { byUnderlying } = await listExpiringOptionsRadar({
    expirationDate: opts.expirationDate,
    topPerUnderlying,
    globalLimit,
    underlyings: underlyingList,
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
        concentration.push(toRow(top, pct, concentrationHint(top, pct, copy), "concentration", copy));
      }
    }

    for (const c of contracts) {
      if (c.volume < 300) continue;
      const volOi = c.volumeOiRatio ?? 0;
      const chg = c.dayChangePct ?? 0;
      if (chg > 0 || volOi >= 1) {
        buySide.push(toRow(c, null, buySideHint(c, copy), "buySide", copy));
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
