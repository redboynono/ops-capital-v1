/**
 * 评级战绩（Track Record）：当前评级自「连续保持起点」以来的收益 vs SPY。
 *
 * 起点 = ticker_ratings_history 中当前 ops_verdict 连续 streak 的最早快照时间。
 * 价格：美股/SPY 走 Massive（Polygon）aggregates；港股/加密走 Yahoo（price-history 1h 缓存）。
 */

import { mysqlQuery } from "@/lib/mysql";
import { getPriceHistory, type PriceHistory, type PriceHistoryRange } from "@/lib/price-history";
import type { Verdict } from "@/lib/ratings";
import { toYahooSymbol } from "@/lib/yahoo";

export type TrackRecordRow = {
  symbol: string;
  name: string;
  asset_class: "equity" | "crypto" | "etf";
  verdict: Verdict;
  since: string;            // ISO 起点日期
  days: number;             // 持续天数
  startPrice: number | null;
  lastPrice: number | null;
  returnPct: number | null; // 评级以来收益
  spyPct: number | null;    // 同期 SPY
  excessPct: number | null; // 超额
};

export type TrackRecordSummary = {
  rows: TrackRecordRow[];
  buyCount: number;          // BUY/STRONG_BUY 样本数
  buyWinRate: number | null; // BUY 组跑赢 SPY 比例
  buyAvgReturn: number | null;
  buyAvgExcess: number | null;
};

type HistRow = { symbol: string; ops_verdict: Verdict | null; captured_at: string };
type RatedRow = {
  symbol: string;
  name: string;
  asset_class: "equity" | "crypto" | "etf";
  ops_verdict: Verdict;
};

function rangeForDays(days: number): PriceHistoryRange {
  if (days <= 80) return "3mo";
  if (days <= 170) return "6mo";
  if (days <= 360) return "1y";
  return "5y";
}

/** 在序列中找 t >= sinceSec 的第一个收盘价 */
function closeAtOrAfter(h: PriceHistory | null, sinceSec: number): number | null {
  if (!h) return null;
  for (const p of h.points) {
    if (p.t >= sinceSec) return p.c;
  }
  return null;
}

function lastClose(h: PriceHistory | null): number | null {
  if (!h || h.points.length === 0) return null;
  return h.points[h.points.length - 1].c;
}

export type TrackRecordTeaser = {
  buyCount: number;
  buyWinRate: number | null;
  buyAvgExcess: number | null;
  buyAvgReturn: number | null;
  top: Array<{ symbol: string; excessPct: number | null; returnPct: number | null }>;
};

// 进程内缓存：战绩计算涉及多次价格序列拉取，付费墙/定价页频繁渲染需缓存
let teaserCache: { at: number; data: TrackRecordTeaser } | null = null;
const TEASER_TTL_MS = 30 * 60 * 1000;

/** 轻量战绩摘要（带 30 分钟进程缓存），用于付费墙/定价页信任条。失败返回 null。 */
export async function getTrackRecordTeaser(): Promise<TrackRecordTeaser | null> {
  if (teaserCache && Date.now() - teaserCache.at < TEASER_TTL_MS) {
    return teaserCache.data;
  }
  try {
    const s = await getTrackRecord();
    const top = s.rows
      .filter((r) => (r.verdict === "BUY" || r.verdict === "STRONG_BUY") && r.excessPct != null)
      .slice(0, 3)
      .map((r) => ({ symbol: r.symbol, excessPct: r.excessPct, returnPct: r.returnPct }));
    const data: TrackRecordTeaser = {
      buyCount: s.buyCount,
      buyWinRate: s.buyWinRate,
      buyAvgExcess: s.buyAvgExcess,
      buyAvgReturn: s.buyAvgReturn,
      top,
    };
    teaserCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

export async function getTrackRecord(): Promise<TrackRecordSummary> {
  const [rated, hist] = await Promise.all([
    mysqlQuery<RatedRow[]>(
      `select r.symbol, t.name, t.asset_class, r.ops_verdict
         from ticker_ratings r
         join tickers t on t.symbol = r.symbol
        where r.ops_verdict is not null`,
    ),
    mysqlQuery<HistRow[]>(
      `select symbol, ops_verdict, captured_at
         from ticker_ratings_history
        where ops_verdict is not null
        order by symbol, captured_at`,
    ),
  ]);

  // symbol -> 按时间升序的快照
  const histBySymbol = new Map<string, HistRow[]>();
  for (const h of hist) {
    const arr = histBySymbol.get(h.symbol) ?? [];
    arr.push(h);
    histBySymbol.set(h.symbol, arr);
  }

  const nowMs = Date.now();
  const candidates: { r: RatedRow; sinceMs: number }[] = [];
  for (const r of rated) {
    const snaps = histBySymbol.get(r.symbol) ?? [];
    // 从最新往回走，找当前 verdict 连续 streak 的最早快照
    let sinceMs: number | null = null;
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (snaps[i].ops_verdict !== r.ops_verdict) break;
      sinceMs = new Date(snaps[i].captured_at).getTime();
    }
    if (sinceMs == null) continue; // 无历史快照，无法计收益
    candidates.push({ r, sinceMs });
  }

  // 价格序列：每个标的 + SPY，按所需最长范围拉取
  const maxDays = Math.max(
    1,
    ...candidates.map((c) => Math.ceil((nowMs - c.sinceMs) / 86_400_000)),
  );
  const spyHist = await getPriceHistory("SPY", rangeForDays(maxDays));

  const rows: TrackRecordRow[] = await Promise.all(
    candidates.map(async ({ r, sinceMs }) => {
      const days = Math.max(0, Math.ceil((nowMs - sinceMs) / 86_400_000));
      const sinceSec = Math.floor(sinceMs / 1000);
      const h = await getPriceHistory(toYahooSymbol(r.symbol), rangeForDays(days));
      const startPrice = closeAtOrAfter(h, sinceSec);
      const lastPrice = lastClose(h);
      const returnPct =
        startPrice != null && lastPrice != null && startPrice > 0
          ? ((lastPrice - startPrice) / startPrice) * 100
          : null;
      const spyStart = closeAtOrAfter(spyHist, sinceSec);
      const spyLast = lastClose(spyHist);
      const spyPct =
        spyStart != null && spyLast != null && spyStart > 0
          ? ((spyLast - spyStart) / spyStart) * 100
          : null;
      return {
        symbol: r.symbol,
        name: r.name,
        asset_class: r.asset_class,
        verdict: r.ops_verdict,
        since: new Date(sinceMs).toISOString().slice(0, 10),
        days,
        startPrice,
        lastPrice,
        returnPct,
        spyPct,
        excessPct: returnPct != null && spyPct != null ? returnPct - spyPct : null,
      };
    }),
  );

  rows.sort((a, b) => (b.excessPct ?? -Infinity) - (a.excessPct ?? -Infinity));

  const buys = rows.filter(
    (x) => (x.verdict === "BUY" || x.verdict === "STRONG_BUY") && x.excessPct != null,
  );
  const wins = buys.filter((x) => (x.excessPct ?? 0) > 0).length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    rows,
    buyCount: buys.length,
    buyWinRate: buys.length ? (wins / buys.length) * 100 : null,
    buyAvgReturn: avg(buys.map((x) => x.returnPct!).filter((v) => v != null)),
    buyAvgExcess: avg(buys.map((x) => x.excessPct!).filter((v) => v != null)),
  };
}
