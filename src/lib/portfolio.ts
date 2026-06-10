import { randomUUID } from "node:crypto";

import { getQuotes, type FinnhubQuote } from "@/lib/finnhub";
import { mysqlQuery } from "@/lib/mysql";
import { upsertTicker } from "@/lib/tickers";

export type PositionRow = {
  id: string;
  user_id: string;
  symbol: string;
  qty: number;
  avg_cost: number;
  opened_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ticker_name?: string | null;
  ticker_exchange?: string | null;
  ticker_sector?: string | null;
};

export type EnrichedPosition = PositionRow & {
  current_price: number | null;
  change_today_pct: number | null;
  market_value: number | null;
  cost_basis: number;
  pnl_abs: number | null;
  pnl_pct: number | null;
  day_pnl_abs: number | null;
};

export type PortfolioSummary = {
  positions: EnrichedPosition[];
  total_market_value: number;
  total_cost_basis: number;
  total_pnl_abs: number;
  total_pnl_pct: number | null;
  day_pnl_abs: number;
  day_pnl_pct: number | null;
  unpriced_count: number;
};

export async function listPositions(userId: string): Promise<PositionRow[]> {
  return mysqlQuery<PositionRow[]>(
    `select p.id, p.user_id, p.symbol, p.qty, p.avg_cost,
            cast(p.opened_at as char) as opened_at, p.notes,
            p.created_at, p.updated_at,
            t.name as ticker_name, t.exchange as ticker_exchange, t.sector as ticker_sector
       from positions p
       left join tickers t on t.symbol = p.symbol
      where p.user_id = ?
      order by p.created_at desc`,
    [userId],
  );
}

export async function getPosition(userId: string, id: string): Promise<PositionRow | null> {
  const rows = await mysqlQuery<PositionRow[]>(
    `select id, user_id, symbol, qty, avg_cost,
            cast(opened_at as char) as opened_at, notes, created_at, updated_at
       from positions
      where user_id = ? and id = ? limit 1`,
    [userId, id],
  );
  return rows[0] ?? null;
}

export async function upsertPosition(input: {
  userId: string;
  symbol: string;
  qty: number;
  avgCost: number;
  openedAt?: string | null;
  notes?: string | null;
}): Promise<string> {
  const sym = input.symbol.toUpperCase().trim();
  if (!sym) throw new Error("symbol required");
  if (!Number.isFinite(input.qty) || input.qty <= 0) throw new Error("qty must be > 0");
  if (!Number.isFinite(input.avgCost) || input.avgCost <= 0) throw new Error("avg_cost must be > 0");

  await upsertTicker(sym); // 保证 fk 不爆
  const id = randomUUID();
  await mysqlQuery(
    `insert into positions (id, user_id, symbol, qty, avg_cost, opened_at, notes)
     values (?, ?, ?, ?, ?, ?, ?)
     on duplicate key update
       qty = values(qty),
       avg_cost = values(avg_cost),
       opened_at = values(opened_at),
       notes = values(notes)`,
    [id, input.userId, sym, input.qty, input.avgCost, input.openedAt ?? null, input.notes ?? null],
  );
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from positions where user_id = ? and symbol = ? limit 1",
    [input.userId, sym],
  );
  return rows[0]?.id ?? id;
}

export async function updatePositionById(
  userId: string,
  id: string,
  patch: { qty?: number; avgCost?: number; openedAt?: string | null; notes?: string | null },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.qty != null) {
    if (!Number.isFinite(patch.qty) || patch.qty <= 0) throw new Error("qty must be > 0");
    fields.push("qty = ?");
    values.push(patch.qty);
  }
  if (patch.avgCost != null) {
    if (!Number.isFinite(patch.avgCost) || patch.avgCost <= 0) throw new Error("avg_cost must be > 0");
    fields.push("avg_cost = ?");
    values.push(patch.avgCost);
  }
  if (patch.openedAt !== undefined) {
    fields.push("opened_at = ?");
    values.push(patch.openedAt);
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?");
    values.push(patch.notes);
  }
  if (fields.length === 0) return;
  values.push(userId, id);
  await mysqlQuery(`update positions set ${fields.join(", ")} where user_id = ? and id = ?`, values);
}

export async function deletePosition(userId: string, id: string): Promise<void> {
  await mysqlQuery("delete from positions where user_id = ? and id = ?", [userId, id]);
}

/**
 * 拉所有 positions 并且并行抓 Finnhub quote，计算市值 + P&L + day P&L。
 * mysql2 把 decimal 当字符串返回，这里强制转 number。
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const rows = await listPositions(userId);
  const symbols = Array.from(new Set(rows.map((r) => r.symbol)));
  const quotes: Record<string, FinnhubQuote | null> = symbols.length
    ? await getQuotes(symbols)
    : {};

  let totalMV = 0;
  let totalCost = 0;
  let totalDayPnl = 0;
  let totalDayCostBase = 0;
  let unpriced = 0;

  const enriched: EnrichedPosition[] = rows.map((r) => {
    const qty = Number(r.qty);
    const cost = Number(r.avg_cost);
    const q = quotes[r.symbol] ?? null;
    const price = q && Number.isFinite(q.c) ? q.c : null;
    const changePct = q && q.dp != null ? q.dp : null;
    const dayChangeAbs = q && q.d != null ? q.d : null;

    const costBasis = cost * qty;
    totalCost += costBasis;

    let mv: number | null = null;
    let pnlAbs: number | null = null;
    let pnlPct: number | null = null;
    let dayPnlAbs: number | null = null;
    if (price != null) {
      mv = price * qty;
      pnlAbs = mv - costBasis;
      pnlPct = costBasis > 0 ? pnlAbs / costBasis : null;
      totalMV += mv;
      if (dayChangeAbs != null) {
        dayPnlAbs = dayChangeAbs * qty;
        totalDayPnl += dayPnlAbs;
        totalDayCostBase += (price - dayChangeAbs) * qty; // 昨收市值
      }
    } else {
      unpriced++;
    }

    return {
      ...r,
      qty,
      avg_cost: cost,
      current_price: price,
      change_today_pct: changePct,
      market_value: mv,
      cost_basis: costBasis,
      pnl_abs: pnlAbs,
      pnl_pct: pnlPct,
      day_pnl_abs: dayPnlAbs,
    };
  });

  const totalPnl = totalMV - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : null;
  const dayPnlPct = totalDayCostBase > 0 ? totalDayPnl / totalDayCostBase : null;

  return {
    positions: enriched,
    total_market_value: totalMV,
    total_cost_basis: totalCost,
    total_pnl_abs: totalPnl,
    total_pnl_pct: totalPnlPct,
    day_pnl_abs: totalDayPnl,
    day_pnl_pct: dayPnlPct,
    unpriced_count: unpriced,
  };
}
