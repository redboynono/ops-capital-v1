import { randomUUID } from "node:crypto";

import { getQuotes, type FinnhubQuote } from "@/lib/finnhub";
import { mysqlQuery } from "@/lib/mysql";
import { getPriceHistory } from "@/lib/price-history";
import { upsertTicker } from "@/lib/tickers";

export type ConvictionList = {
  id: string;
  period_label: string;
  publish_date: string;
  end_date: string | null;
  thesis: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type ConvictionPick = {
  id: string;
  list_id: string;
  symbol: string;
  entry_price: number;
  weight: number;
  thesis: string | null;
  sort_order: number;
  ticker_name?: string | null;
  ticker_exchange?: string | null;
};

export type EnrichedPick = ConvictionPick & {
  current_price: number | null;
  return_pct: number | null;
  weighted_contribution: number | null; // weight * return_pct
};

export type ListPerformance = {
  list: ConvictionList;
  picks: EnrichedPick[];
  total_return_pct: number | null;
  best: EnrichedPick | null;
  worst: EnrichedPick | null;
  unpriced_count: number;
  // SPY 同期回报，用 publish_date 之后第一根可得收盘 vs 最新收盘
  benchmark: { symbol: "SPY"; return_pct: number | null } | null;
  alpha_pct: number | null; // list - benchmark
};

export async function listAllConvictionLists(): Promise<ConvictionList[]> {
  return mysqlQuery<ConvictionList[]>(
    `select id, period_label,
            cast(publish_date as char) as publish_date,
            cast(end_date as char) as end_date,
            thesis, is_active, created_at, updated_at
       from conviction_lists
      order by publish_date desc`,
  );
}

export async function getConvictionList(id: string): Promise<ConvictionList | null> {
  const rows = await mysqlQuery<ConvictionList[]>(
    `select id, period_label,
            cast(publish_date as char) as publish_date,
            cast(end_date as char) as end_date,
            thesis, is_active, created_at, updated_at
       from conviction_lists where id = ? limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listPicksForList(listId: string): Promise<ConvictionPick[]> {
  const rows = await mysqlQuery<ConvictionPick[]>(
    `select cp.id, cp.list_id, cp.symbol, cp.entry_price, cp.weight, cp.thesis, cp.sort_order,
            t.name as ticker_name, t.exchange as ticker_exchange
       from conviction_picks cp
       left join tickers t on t.symbol = cp.symbol
      where cp.list_id = ?
      order by cp.sort_order asc, cp.symbol asc`,
    [listId],
  );
  // mysql2 把 decimal 当字符串返回；统一强制转 number。
  return rows.map((r) => ({
    ...r,
    entry_price: Number(r.entry_price),
    weight: Number(r.weight),
  }));
}

/** 拉这份榜单 + 实时 quote，计算每只标的回报 + 加权贡献 + 总回报。 */
export async function getListPerformance(id: string): Promise<ListPerformance | null> {
  const list = await getConvictionList(id);
  if (!list) return null;
  const picks = await listPicksForList(id);
  if (picks.length === 0) {
    return {
      list,
      picks: [],
      total_return_pct: null,
      best: null,
      worst: null,
      unpriced_count: 0,
      benchmark: null,
      alpha_pct: null,
    };
  }

  const quotes: Record<string, FinnhubQuote | null> = await getQuotes(
    Array.from(new Set(picks.map((p) => p.symbol))),
  );

  let totalContribution = 0;
  let totalWeight = 0;
  let unpriced = 0;
  const enriched: EnrichedPick[] = picks.map((p) => {
    const q = quotes[p.symbol] ?? null;
    const price = q && Number.isFinite(q.c) ? q.c : null;
    const returnPct = price != null && p.entry_price > 0 ? price / p.entry_price - 1 : null;
    const contribution = returnPct != null ? returnPct * p.weight : null;
    if (price == null) unpriced++;
    if (contribution != null) {
      totalContribution += contribution;
      totalWeight += p.weight;
    }
    return {
      ...p,
      current_price: price,
      return_pct: returnPct,
      weighted_contribution: contribution,
    };
  });

  // 总回报：sum(weight * return) / sum(weight)，用已定价的部分归一化
  const totalReturn = totalWeight > 0 ? totalContribution / totalWeight : null;

  const priced = enriched.filter((e) => e.return_pct != null);
  const best = priced.length
    ? priced.reduce((a, b) => ((a.return_pct ?? -Infinity) >= (b.return_pct ?? -Infinity) ? a : b))
    : null;
  const worst = priced.length
    ? priced.reduce((a, b) => ((a.return_pct ?? Infinity) <= (b.return_pct ?? Infinity) ? a : b))
    : null;

  // SPY 同期回报：用 publish_date 之后第一个交易日的 close 作为基准锚点
  const benchmarkReturn = await computeSpyBenchmark(list.publish_date);
  const alpha = totalReturn != null && benchmarkReturn != null ? totalReturn - benchmarkReturn : null;

  return {
    list,
    picks: enriched,
    total_return_pct: totalReturn,
    best,
    worst,
    unpriced_count: unpriced,
    benchmark: { symbol: "SPY", return_pct: benchmarkReturn },
    alpha_pct: alpha,
  };
}

/**
 * 计算 SPY 从 publishDate（含）到最新可得收盘的总回报。
 * 用 Yahoo 5y 月线（够用，sparkline 已缓存），找到第一个 t >= publishDate 的 close。
 */
async function computeSpyBenchmark(publishDate: string): Promise<number | null> {
  const startMs = new Date(publishDate + "T00:00:00Z").getTime();
  if (Number.isNaN(startMs)) return null;
  const ageDays = (Date.now() - startMs) / 86_400_000;
  // 选最贴近的 range：榜单越早越用粗粒度
  const range = ageDays <= 30 ? "1mo" : ageDays <= 90 ? "3mo" : ageDays <= 365 ? "1y" : "5y";
  const history = await getPriceHistory("SPY", range);
  if (!history || history.points.length < 2) return null;
  const anchor = history.points.find((p) => p.t * 1000 >= startMs);
  if (!anchor) return null;
  const last = history.points[history.points.length - 1];
  if (anchor.c <= 0) return null;
  return last.c / anchor.c - 1;
}

// ---------------- admin write helpers ----------------

export async function createConvictionList(input: {
  periodLabel: string;
  publishDate: string;
  thesis?: string | null;
}): Promise<string> {
  const id = randomUUID();
  await mysqlQuery(
    `insert into conviction_lists (id, period_label, publish_date, thesis)
     values (?, ?, ?, ?)`,
    [id, input.periodLabel.trim(), input.publishDate, input.thesis ?? null],
  );
  return id;
}

export async function updateConvictionList(
  id: string,
  patch: { periodLabel?: string; publishDate?: string; endDate?: string | null; thesis?: string | null; isActive?: boolean },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.periodLabel != null) {
    fields.push("period_label = ?");
    values.push(patch.periodLabel.trim());
  }
  if (patch.publishDate != null) {
    fields.push("publish_date = ?");
    values.push(patch.publishDate);
  }
  if (patch.endDate !== undefined) {
    fields.push("end_date = ?");
    values.push(patch.endDate);
  }
  if (patch.thesis !== undefined) {
    fields.push("thesis = ?");
    values.push(patch.thesis);
  }
  if (patch.isActive != null) {
    fields.push("is_active = ?");
    values.push(patch.isActive ? 1 : 0);
  }
  if (fields.length === 0) return;
  values.push(id);
  await mysqlQuery(`update conviction_lists set ${fields.join(", ")} where id = ?`, values);
}

export async function deleteConvictionList(id: string): Promise<void> {
  await mysqlQuery("delete from conviction_lists where id = ?", [id]);
}

export async function upsertConvictionPick(input: {
  listId: string;
  symbol: string;
  entryPrice: number;
  weight: number;
  thesis?: string | null;
  sortOrder?: number;
}): Promise<string> {
  const sym = input.symbol.toUpperCase().trim();
  if (!sym) throw new Error("symbol required");
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) throw new Error("entry_price > 0");
  if (!Number.isFinite(input.weight) || input.weight <= 0) throw new Error("weight > 0");

  await upsertTicker(sym);
  const id = randomUUID();
  await mysqlQuery(
    `insert into conviction_picks (id, list_id, symbol, entry_price, weight, thesis, sort_order)
     values (?, ?, ?, ?, ?, ?, ?)
     on duplicate key update
       entry_price = values(entry_price),
       weight = values(weight),
       thesis = values(thesis),
       sort_order = values(sort_order)`,
    [
      id,
      input.listId,
      sym,
      input.entryPrice,
      input.weight,
      input.thesis ?? null,
      input.sortOrder ?? 0,
    ],
  );
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from conviction_picks where list_id = ? and symbol = ? limit 1",
    [input.listId, sym],
  );
  return rows[0]?.id ?? id;
}

export async function deleteConvictionPick(listId: string, pickId: string): Promise<void> {
  await mysqlQuery("delete from conviction_picks where list_id = ? and id = ?", [listId, pickId]);
}
