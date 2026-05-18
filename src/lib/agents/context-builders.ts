/**
 * 各 Agent 专属的"额外上下文"构建器。
 * 所有 ticker-类 Agent 都默认拿到 buildTickerFactsheet()，再用这里的扩展叠加专属数据。
 */

import { buildTickerFactsheet } from "@/lib/ai/factsheet";
import { fetchCompanyNews, fetchEarningsCalendar, getQuote } from "@/lib/finnhub";
import { mysqlQuery } from "@/lib/mysql";
import { listRelatedTickers } from "@/lib/tickers";

const NEWS_LOOKBACK_DAYS_DEFAULT = 30;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** 默认 ticker 上下文：直接复用 factsheet。 */
export async function buildBaseTickerContext(symbol: string): Promise<string> {
  const sheet = await buildTickerFactsheet(symbol);
  return `# 当前讨论的标的：${symbol.toUpperCase()}\n\n${sheet}`;
}

/** Peer comparison：本只 + 4 只同行业 factsheet 的"瘦身版"。 */
export async function buildPeerComparisonContext(symbol: string): Promise<{
  context: string;
  peers: string[];
}> {
  // 当前 ticker 的 sector
  const [self] = await mysqlQuery<{ sector: string | null }[]>(
    "select sector from tickers where symbol = ? limit 1",
    [symbol.toUpperCase()],
  );
  const sector = self?.sector ?? null;
  const peers = await listRelatedTickers(symbol.toUpperCase(), sector, 4);

  const parts: string[] = [];
  parts.push(await buildBaseTickerContext(symbol));
  parts.push("");
  parts.push(`# 同行业 ${peers.length} 只对照（${sector ?? "无 sector 数据"}）`);
  for (const p of peers) {
    parts.push("");
    parts.push(await buildTickerFactsheet(p.symbol));
  }
  return { context: parts.join("\n"), peers: peers.map((p) => p.symbol) };
}

/** News recap：拉过去 N 天新闻 + 实时 quote 当作"最终态"。 */
export async function buildNewsRecapContext(
  symbol: string,
  days = NEWS_LOOKBACK_DAYS_DEFAULT,
): Promise<{ context: string; newsCount: number }> {
  const sym = symbol.toUpperCase();
  const isoFrom = isoDaysAgo(days);
  const isoTo = new Date().toISOString().slice(0, 10);

  const [profile, quote, news] = await Promise.all([
    buildBaseTickerContext(sym),
    getQuote(sym).catch(() => null),
    fetchCompanyNews(sym, isoFrom, isoTo, 30).catch(() => []),
  ]);

  const parts: string[] = [];
  parts.push(profile);
  parts.push("");
  parts.push(`# 过去 ${days} 天新闻流（${isoFrom} → ${isoTo}，共 ${news.length} 条）`);
  if (news.length === 0) {
    parts.push("- (该窗口无新闻)");
  } else {
    for (const n of news) {
      const date = new Date(n.datetime * 1000).toISOString().slice(0, 10);
      parts.push(`- [${date}] ${n.headline}（${n.source ?? "?"}）`);
      if (n.summary) parts.push(`  ${String(n.summary).slice(0, 240)}`);
    }
  }

  if (quote && Number.isFinite(quote.c)) {
    parts.push("");
    parts.push(`# 当前股价快照`);
    parts.push(
      `- 现价 $${quote.c.toFixed(2)}（今日 ${quote.dp != null ? quote.dp.toFixed(2) : "?"}%）`,
    );
  }
  return { context: parts.join("\n"), newsCount: news.length };
}

/** Upcoming events：财报日 + 已知行业事件 + 估值里程碑。 */
export async function buildUpcomingEventsContext(symbol: string): Promise<{
  context: string;
  upcomingCount: number;
}> {
  const sym = symbol.toUpperCase();
  const base = await buildBaseTickerContext(sym);

  // 1) 该标的未来 90 天财报
  const earnings = await mysqlQuery<
    Array<{
      report_date: string;
      report_time: string | null;
      fiscal_year: number;
      fiscal_quarter: number;
      eps_estimate: number | null;
      revenue_estimate: number | null;
    }>
  >(
    `select report_date, report_time, fiscal_year, fiscal_quarter, eps_estimate, revenue_estimate
       from earnings_releases
      where symbol = ?
        and report_date between current_date and date_add(current_date, interval 120 day)
      order by report_date asc
      limit 4`,
    [sym],
  );

  // 2) 大盘宏观节奏（FOMC / CPI / NFP — 简化为固定提示，让 LLM 自己挑）
  const parts: string[] = [];
  parts.push(base);
  parts.push("");
  parts.push(`# ${sym} 已知未来财报（120 天内）`);
  if (earnings.length === 0) {
    parts.push("- (DB 内暂无未来财报记录；可能需要 LLM 根据行业历史推断时点)");
  } else {
    for (const e of earnings) {
      const date = new Date(e.report_date).toISOString().slice(0, 10);
      const time = e.report_time ?? "?";
      parts.push(
        `- ${date} (${time}) FY${e.fiscal_year} Q${e.fiscal_quarter} · EPS est=${e.eps_estimate ?? "n/a"} · Revenue est=${e.revenue_estimate ?? "n/a"}`,
      );
    }
  }

  // 3) 通用宏观节奏（粗粒度）— LLM 知道这些节奏，但提示一下
  parts.push("");
  parts.push(`# 通用宏观节奏（参考）`);
  parts.push(`- FOMC 利率会议：3/6/9/12 月；CPI/PPI/NFP 每月固定时间发布。`);
  parts.push(`- Earnings season：1/4/7/10 月中下旬集中。`);

  return { context: parts.join("\n"), upcomingCount: earnings.length };
}

/** Position advice：base + 用户当前在该标的的持仓情况 + watchlist 概览。 */
export async function buildPositionAdviceContext(
  symbol: string,
  userId: string,
): Promise<{ context: string; hasPosition: boolean }> {
  const sym = symbol.toUpperCase();
  const base = await buildBaseTickerContext(sym);

  const [thisPos] = await mysqlQuery<
    Array<{
      qty: number | null;
      avg_cost: number | null;
      opened_at: string | null;
      notes: string | null;
    }>
  >(
    `select qty, avg_cost, opened_at, notes
       from positions
      where user_id = ? and symbol = ?
      limit 1`,
    [userId, sym],
  );

  const allPos = await mysqlQuery<
    Array<{ symbol: string; qty: number | null; avg_cost: number | null }>
  >(
    `select symbol, qty, avg_cost
       from positions
      where user_id = ?
      order by symbol`,
    [userId],
  );

  const parts: string[] = [];
  parts.push(base);
  parts.push("");
  parts.push(`# 用户当前在 ${sym} 的持仓`);
  if (!thisPos || !thisPos.qty || !thisPos.avg_cost) {
    parts.push(`- 暂无该标的持仓（用户在询问"建仓"建议）`);
  } else {
    parts.push(
      `- 数量：${thisPos.qty} 股 · 均价 $${Number(thisPos.avg_cost).toFixed(2)} · 建仓时间：${
        thisPos.opened_at ? new Date(thisPos.opened_at).toISOString().slice(0, 10) : "?"
      }`,
    );
    if (thisPos.notes) parts.push(`- 用户备注：${thisPos.notes}`);
  }

  parts.push("");
  parts.push(`# 用户全部持仓（${allPos.length} 个标的，作分散度参考）`);
  if (allPos.length === 0) {
    parts.push("- (无其他持仓)");
  } else {
    for (const p of allPos.slice(0, 20)) {
      parts.push(
        `- ${p.symbol}: ${p.qty ?? "?"} 股 @ $${p.avg_cost ? Number(p.avg_cost).toFixed(2) : "?"}`,
      );
    }
  }

  return {
    context: parts.join("\n"),
    hasPosition: !!(thisPos?.qty && thisPos?.avg_cost),
  };
}
