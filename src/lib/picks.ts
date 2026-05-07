import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import { getQuotes } from "@/lib/yahoo";

export type PickStatus = "open" | "closed" | "stopped";
export type PickConviction = "high" | "medium" | "low";

export type Pick = {
  id: string;
  slug: string;
  ticker_symbol: string;
  ticker_name: string | null;
  title: string;
  subtitle: string | null;
  thesis_md: string;
  catalysts_md: string | null;
  risks_md: string | null;
  valuation_md: string | null;
  sell_discipline_md: string | null;
  entry_price: number;
  entry_date: string;            // YYYY-MM-DD
  target_price: number | null;
  stop_price: number | null;
  horizon_months: number;
  conviction: PickConviction;
  tags: string | null;
  status: PickStatus;
  close_price: number | null;
  close_date: string | null;
  close_reason: string | null;
  is_premium: number;
  is_published: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PickRow = Omit<Pick, "entry_price" | "target_price" | "stop_price" | "close_price"> & {
  entry_price: string | number;
  target_price: string | number | null;
  stop_price: string | number | null;
  close_price: string | number | null;
};

function rowToPick(r: PickRow): Pick {
  return {
    ...r,
    entry_price: Number(r.entry_price),
    target_price: r.target_price == null ? null : Number(r.target_price),
    stop_price: r.stop_price == null ? null : Number(r.stop_price),
    close_price: r.close_price == null ? null : Number(r.close_price),
  };
}

export async function listPublishedPicks(status?: PickStatus): Promise<Pick[]> {
  const rows = status
    ? await mysqlQuery<PickRow[]>(
        "select * from ops_picks where is_published = 1 and status = ? order by entry_date desc, created_at desc",
        [status],
      )
    : await mysqlQuery<PickRow[]>(
        "select * from ops_picks where is_published = 1 order by entry_date desc, created_at desc",
      );
  return rows.map(rowToPick);
}

export async function listAllPicks(): Promise<Pick[]> {
  const rows = await mysqlQuery<PickRow[]>(
    "select * from ops_picks order by entry_date desc, created_at desc",
  );
  return rows.map(rowToPick);
}

export async function getPickBySlug(slug: string): Promise<Pick | null> {
  const rows = await mysqlQuery<PickRow[]>(
    "select * from ops_picks where slug = ? limit 1",
    [slug],
  );
  return rows[0] ? rowToPick(rows[0]) : null;
}

export async function getPickById(id: string): Promise<Pick | null> {
  const rows = await mysqlQuery<PickRow[]>(
    "select * from ops_picks where id = ? limit 1",
    [id],
  );
  return rows[0] ? rowToPick(rows[0]) : null;
}

export type UpsertPickInput = {
  id?: string;
  slug: string;
  ticker_symbol: string;
  ticker_name?: string | null;
  title: string;
  subtitle?: string | null;
  thesis_md: string;
  catalysts_md?: string | null;
  risks_md?: string | null;
  valuation_md?: string | null;
  sell_discipline_md?: string | null;
  entry_price: number;
  entry_date: string;
  target_price?: number | null;
  stop_price?: number | null;
  horizon_months?: number;
  conviction?: PickConviction;
  tags?: string | null;
  status?: PickStatus;
  close_price?: number | null;
  close_date?: string | null;
  close_reason?: string | null;
  is_premium?: boolean;
  is_published?: boolean;
  created_by?: string | null;
};

export async function upsertPick(input: UpsertPickInput): Promise<{ id: string }> {
  const existing = await mysqlQuery<{ id: string }[]>(
    "select id from ops_picks where slug = ? limit 1",
    [input.slug],
  );
  const id = existing[0]?.id ?? input.id ?? randomUUID();

  // Sync ticker into the index automatically. If the symbol isn't in `tickers`
  // yet, insert a stub row so the Pick page links resolve and the daily ratings
  // cron picks it up. Idempotent — existing rows keep their richer metadata
  // (exchange/sector) untouched.
  const sym = input.ticker_symbol.toUpperCase();
  const nm = (input.ticker_name && input.ticker_name.trim()) || sym;
  await mysqlQuery(
    `insert into tickers (symbol, name) values (?, ?)
     on duplicate key update name = if(values(name) = symbol, name, values(name))`,
    [sym, nm],
  );

  const values = [
    input.slug,
    input.ticker_symbol.toUpperCase(),
    input.ticker_name ?? null,
    input.title,
    input.subtitle ?? null,
    input.thesis_md,
    input.catalysts_md ?? null,
    input.risks_md ?? null,
    input.valuation_md ?? null,
    input.sell_discipline_md ?? null,
    input.entry_price,
    input.entry_date,
    input.target_price ?? null,
    input.stop_price ?? null,
    input.horizon_months ?? 12,
    input.conviction ?? "medium",
    input.tags ?? null,
    input.status ?? "open",
    input.close_price ?? null,
    input.close_date ?? null,
    input.close_reason ?? null,
    input.is_premium === false ? 0 : 1,
    input.is_published ? 1 : 0,
  ];

  if (existing[0]) {
    await mysqlQuery(
      `update ops_picks set
        slug=?, ticker_symbol=?, ticker_name=?, title=?, subtitle=?,
        thesis_md=?, catalysts_md=?, risks_md=?, valuation_md=?, sell_discipline_md=?,
        entry_price=?, entry_date=?, target_price=?, stop_price=?, horizon_months=?,
        conviction=?, tags=?, status=?, close_price=?, close_date=?, close_reason=?,
        is_premium=?, is_published=?
       where id=?`,
      [...values, id],
    );
  } else {
    await mysqlQuery(
      `insert into ops_picks (
        id, slug, ticker_symbol, ticker_name, title, subtitle,
        thesis_md, catalysts_md, risks_md, valuation_md, sell_discipline_md,
        entry_price, entry_date, target_price, stop_price, horizon_months,
        conviction, tags, status, close_price, close_date, close_reason,
        is_premium, is_published, created_by
      ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, ...values, input.created_by ?? null],
    );
  }
  return { id };
}

export async function deletePick(id: string): Promise<void> {
  await mysqlQuery("delete from ops_picks where id = ?", [id]);
}

// ————————————————————————————————————————————————
// Performance calculation helpers
// ————————————————————————————————————————————————

/**
 * Map an internal ticker symbol (as stored in ops_picks.ticker_symbol) to a
 * Yahoo-compatible symbol so we can pull live quotes for open positions.
 * e.g. "00700" → "0700.HK", "600519" → "600519.SS", "BTC" → "BTC-USD"
 */
export function tickerToYahoo(symbol: string): string {
  const s = symbol.toUpperCase();
  // HK 5-digit codes like 00700 → 0700.HK (drop leading zero to 4 digits)
  if (/^\d{4,5}$/.test(s)) {
    const four = s.padStart(5, "0").slice(-5).replace(/^0/, "");
    return `${four}.HK`;
  }
  // A-shares: 6xxxxx = Shanghai, 0xxxxx/3xxxxx = Shenzhen
  if (/^6\d{5}$/.test(s)) return `${s}.SS`;
  if (/^(00|30)\d{4}$/.test(s)) return `${s}.SZ`;
  // Crypto shorthand
  if (/^(BTC|ETH|SOL|BNB|XRP|DOGE)$/.test(s)) return `${s}-USD`;
  return s; // US stock default
}

export type PickPerformance = {
  currentPrice: number | null;
  unrealizedPct: number | null;   // only for open
  realizedPct: number | null;      // only for closed/stopped
  daysHeld: number;
};

export async function computePerformance(pick: Pick): Promise<PickPerformance> {
  const entry = new Date(pick.entry_date);
  const endDate = pick.close_date ? new Date(pick.close_date) : new Date();
  const daysHeld = Math.max(0, Math.floor((endDate.getTime() - entry.getTime()) / 86400000));

  if (pick.status !== "open") {
    const cp = pick.close_price;
    const realizedPct = cp != null ? ((cp - pick.entry_price) / pick.entry_price) * 100 : null;
    return { currentPrice: cp, unrealizedPct: null, realizedPct, daysHeld };
  }

  // Open — fetch live price
  const yahoo = tickerToYahoo(pick.ticker_symbol);
  const quotes = await getQuotes([yahoo]).catch(() => ({}) as Record<string, { c: number } | null>);
  const q = quotes[yahoo];
  const current = q?.c ?? null;
  const unrealizedPct = current != null
    ? ((current - pick.entry_price) / pick.entry_price) * 100
    : null;
  return { currentPrice: current, unrealizedPct, realizedPct: null, daysHeld };
}

export async function computeManyPerformance(picks: Pick[]): Promise<Map<string, PickPerformance>> {
  const openPicks = picks.filter((p) => p.status === "open");
  const yahooSymbols = Array.from(new Set(openPicks.map((p) => tickerToYahoo(p.ticker_symbol))));
  const quotes = yahooSymbols.length
    ? await getQuotes(yahooSymbols).catch(() => ({}) as Record<string, { c: number } | null>)
    : ({} as Record<string, { c: number } | null>);

  const map = new Map<string, PickPerformance>();
  for (const p of picks) {
    const entry = new Date(p.entry_date);
    const endDate = p.close_date ? new Date(p.close_date) : new Date();
    const daysHeld = Math.max(0, Math.floor((endDate.getTime() - entry.getTime()) / 86400000));

    if (p.status !== "open") {
      const cp = p.close_price;
      const realizedPct = cp != null ? ((cp - p.entry_price) / p.entry_price) * 100 : null;
      map.set(p.id, { currentPrice: cp, unrealizedPct: null, realizedPct, daysHeld });
    } else {
      const y = tickerToYahoo(p.ticker_symbol);
      const current = quotes[y]?.c ?? null;
      const unrealizedPct = current != null
        ? ((current - p.entry_price) / p.entry_price) * 100
        : null;
      map.set(p.id, { currentPrice: current, unrealizedPct, realizedPct: null, daysHeld });
    }
  }
  return map;
}

export type PortfolioSummary = {
  openCount: number;
  closedCount: number;
  avgReturnPct: number | null;          // equal-weight avg of realized returns
  avgOpenUnrealizedPct: number | null;  // equal-weight avg of unrealized
  totalPicks: number;
  winRatePct: number | null;            // % of closed positions with realized > 0
  bestClosed: { slug: string; ticker: string; pct: number } | null;
  worstClosed: { slug: string; ticker: string; pct: number } | null;
};

export async function computePortfolio(picks: Pick[]): Promise<PortfolioSummary> {
  const perf = await computeManyPerformance(picks);

  const open = picks.filter((p) => p.status === "open");
  const closed = picks.filter((p) => p.status !== "open");

  const realizedValues = closed
    .map((p) => ({ p, r: perf.get(p.id)?.realizedPct })) .filter((x): x is { p: Pick; r: number } => typeof x.r === "number");
  const unrealizedValues = open
    .map((p) => perf.get(p.id)?.unrealizedPct)
    .filter((r): r is number => typeof r === "number");

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const wins = realizedValues.filter((x) => x.r > 0).length;
  const winRatePct = realizedValues.length ? (wins / realizedValues.length) * 100 : null;

  const sorted = [...realizedValues].sort((a, b) => b.r - a.r);
  const bestClosed = sorted[0]
    ? { slug: sorted[0].p.slug, ticker: sorted[0].p.ticker_symbol, pct: sorted[0].r }
    : null;
  const worstClosed = sorted.at(-1)
    ? { slug: sorted.at(-1)!.p.slug, ticker: sorted.at(-1)!.p.ticker_symbol, pct: sorted.at(-1)!.r }
    : null;

  return {
    openCount: open.length,
    closedCount: closed.length,
    totalPicks: picks.length,
    avgReturnPct: avg(realizedValues.map((x) => x.r)),
    avgOpenUnrealizedPct: avg(unrealizedValues),
    winRatePct,
    bestClosed,
    worstClosed,
  };
}
