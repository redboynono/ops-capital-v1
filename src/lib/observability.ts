/**
 * 运营观测 helper —— 给 TS 侧（API cron route + 业务路径）用。
 *
 * 提供：
 *   - runJobTs(): 跟 scripts/lib/job-runner.mjs 同构，把一段异步逻辑包成 job_runs 行
 *   - logEvent(): 极轻量的行为打点，写 events 表，永远 fire-and-forget
 *
 * 设计原则：
 *   - 任何观测调用都不能让业务流程失败（catch+swallow）
 *   - 写一次连接，复用同一个 mysql pool
 */

import { randomUUID } from "node:crypto";
import os from "node:os";

import { mysqlQuery } from "@/lib/mysql";

// ============================ job_runs ============================ //

export type JobCtx = {
  jobId: string;
  jobName: string;
  startedAt: Date;
  itemsTotal: number | null;
  itemsOk: number | null;
  itemsFailed: number | null;
  meta: Record<string, unknown> | null;
};

export async function runJobTs<T>(
  opts: { jobName: string },
  fn: (ctx: JobCtx) => Promise<T>,
): Promise<T> {
  const id = randomUUID();
  const startedAt = new Date();
  const host = `${os.hostname()}`.slice(0, 60);

  try {
    await mysqlQuery(
      `insert into job_runs (id, job_name, started_at, status, host)
       values (?, ?, ?, 'running', ?)`,
      [id, opts.jobName, startedAt, host],
    );
  } catch (e) {
    // 表不存在 / DB 挂了：直接放行，不阻塞业务
    console.warn(`[observability] failed to insert job_runs row:`, (e as Error).message);
  }

  const ctx: JobCtx = {
    jobId: id,
    jobName: opts.jobName,
    startedAt,
    itemsTotal: null,
    itemsOk: null,
    itemsFailed: null,
    meta: null,
  };

  let status: "ok" | "failed" | "partial" = "ok";
  let errorMessage: string | null = null;
  let thrown: unknown = null;
  let result: T;

  try {
    result = await fn(ctx);
    if ((ctx.itemsFailed ?? 0) > 0 && (ctx.itemsOk ?? 0) > 0) status = "partial";
    else if ((ctx.itemsFailed ?? 0) > 0 && !(ctx.itemsOk ?? 0)) status = "failed";
  } catch (err) {
    status = "failed";
    errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 990);
    thrown = err;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  try {
    await mysqlQuery(
      `update job_runs
         set finished_at = ?, status = ?, items_total = ?, items_ok = ?, items_failed = ?,
             duration_ms = ?, error_message = ?, meta_json = ?
       where id = ?`,
      [
        finishedAt,
        status,
        ctx.itemsTotal,
        ctx.itemsOk,
        ctx.itemsFailed,
        durationMs,
        errorMessage,
        ctx.meta ? JSON.stringify(ctx.meta) : null,
        id,
      ],
    );
  } catch (e) {
    console.warn(`[observability] failed to finalize job_runs row:`, (e as Error).message);
  }

  if (thrown) throw thrown;
  return result!;
}

// ============================ events ============================ //

export type EventType =
  | "page_view"
  | "ai_query"
  | "watchlist_add"
  | "watchlist_remove"
  | "position_add"
  | "alert_create"
  | "alert_trigger"
  | "briefing_view"
  | "briefing_email_sent"
  | "compare_view"
  | "screener_apply"
  | "earnings_view"
  | "user_signup"
  | "user_login";

/**
 * 极轻量打点。永远 fire-and-forget；调用方不需要 await。
 * 业务路径用法：logEvent("ai_query", { userId, symbol, meta: { tokens: 1234 } });
 */
export function logEvent(
  eventType: EventType | string,
  opts: {
    userId?: string | null;
    symbol?: string | null;
    meta?: Record<string, unknown>;
  } = {},
): void {
  const promise = mysqlQuery(
    `insert into events (event_type, user_id, symbol, meta_json) values (?, ?, ?, ?)`,
    [
      eventType,
      opts.userId ?? null,
      opts.symbol ? opts.symbol.toUpperCase().slice(0, 32) : null,
      opts.meta ? JSON.stringify(opts.meta) : null,
    ],
  );
  // 完全吞掉错误：observability 永远不能拖累业务
  Promise.resolve(promise).catch((e) => {
    console.warn(`[observability] logEvent failed (${eventType}):`, (e as Error)?.message);
  });
}
