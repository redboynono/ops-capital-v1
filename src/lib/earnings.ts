import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import type { FinnhubEarningRow } from "@/lib/finnhub";

export type EarningsRow = {
  id: string;
  symbol: string;
  fiscal_year: number;
  fiscal_quarter: number;
  report_date: string;
  hour: string | null;
  eps_actual: number | null;
  eps_estimate: number | null;
  revenue_actual: number | null;
  revenue_estimate: number | null;
  post_id: string | null;
  generation_attempts: number;
  last_error: string | null;
};

/**
 * 写入财报记录（按 symbol/year/quarter 唯一）。
 * 已存在则更新数值字段（财报数字可能由 estimate 转为 actual）。
 */
export async function upsertEarningsRelease(input: FinnhubEarningRow): Promise<string> {
  const id = randomUUID();
  await mysqlQuery(
    `insert into earnings_releases
       (id, symbol, fiscal_year, fiscal_quarter, report_date, hour,
        eps_actual, eps_estimate, revenue_actual, revenue_estimate)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on duplicate key update
       report_date = values(report_date),
       hour = values(hour),
       eps_actual = values(eps_actual),
       eps_estimate = values(eps_estimate),
       revenue_actual = values(revenue_actual),
       revenue_estimate = values(revenue_estimate)`,
    [
      id,
      input.symbol,
      input.year,
      input.quarter,
      input.date,
      input.hour ?? null,
      input.epsActual,
      input.epsEstimate,
      input.revenueActual,
      input.revenueEstimate,
    ],
  );
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from earnings_releases where symbol = ? and fiscal_year = ? and fiscal_quarter = ? limit 1",
    [input.symbol, input.year, input.quarter],
  );
  return rows[0]?.id ?? id;
}

/**
 * 找出已释放（eps_actual 非空）但还没生成文章的财报。
 * generation_attempts < 3 防止反复失败死循环。
 */
export async function listPendingEarnings(symbols: string[]): Promise<EarningsRow[]> {
  if (symbols.length === 0) return [];
  const placeholders = symbols.map(() => "?").join(",");
  return mysqlQuery<EarningsRow[]>(
    `select id, symbol, fiscal_year, fiscal_quarter, report_date, hour,
            eps_actual, eps_estimate, revenue_actual, revenue_estimate,
            post_id, generation_attempts, last_error
       from earnings_releases
      where symbol in (${placeholders})
        and eps_actual is not null
        and post_id is null
        and generation_attempts < 3
      order by report_date desc, symbol`,
    symbols,
  );
}

export async function linkEarningsPost(earningsId: string, postId: string): Promise<void> {
  await mysqlQuery(
    "update earnings_releases set post_id = ?, last_error = null where id = ?",
    [postId, earningsId],
  );
}

export async function recordGenerationFailure(
  earningsId: string,
  errorMessage: string,
): Promise<void> {
  await mysqlQuery(
    "update earnings_releases set generation_attempts = generation_attempts + 1, last_error = ? where id = ?",
    [errorMessage.slice(0, 500), earningsId],
  );
}
