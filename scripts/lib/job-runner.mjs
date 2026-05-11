/**
 * 通用 job runner — 让所有 cron 脚本统一报告执行情况。
 *
 * 用法：
 *   import { runJob } from "./lib/job-runner.mjs";
 *   await runJob({ jobName: "daily-news", mysqlUrl: process.env.MYSQL_URL }, async (ctx) => {
 *     // ... 干活
 *     ctx.itemsTotal = N; ctx.itemsOk = X; ctx.itemsFailed = Y;
 *     ctx.meta = { rangeFrom, rangeTo };
 *   });
 *
 * 保证：
 *   - 一定写一行 job_runs（哪怕崩了）
 *   - exit code 跟成功/失败匹配（cron 邮件依赖）
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";
import os from "node:os";

export async function runJob({ jobName, mysqlUrl }, fn) {
  if (!jobName) throw new Error("jobName required");
  if (!mysqlUrl) throw new Error("mysqlUrl required");

  const id = crypto.randomUUID();
  const startedAt = new Date();
  const host = `${os.hostname()}`.slice(0, 60);

  // 单独一个 conn 专门用于写 job_runs（避免业务 conn 关闭后写不进去）
  const meta = await mysql.createConnection(mysqlUrl);

  await meta.execute(
    `insert into job_runs (id, job_name, started_at, status, host)
     values (?, ?, ?, 'running', ?)`,
    [id, jobName, startedAt, host],
  );

  const ctx = {
    jobId: id,
    jobName,
    startedAt,
    itemsTotal: null,
    itemsOk: null,
    itemsFailed: null,
    meta: null,
  };

  let status = "ok";
  let errorMessage = null;
  let thrown = null;

  try {
    await fn(ctx);
    // 若用户主动 set ctx.itemsFailed > 0 但没抛错 → partial
    if ((ctx.itemsFailed ?? 0) > 0 && (ctx.itemsOk ?? 0) > 0) status = "partial";
    else if ((ctx.itemsFailed ?? 0) > 0 && !(ctx.itemsOk ?? 0)) status = "failed";
  } catch (err) {
    status = "failed";
    errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 990);
    thrown = err;
  } finally {
    const finishedAt = new Date();
    const durationMs = finishedAt - startedAt;
    try {
      await meta.execute(
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
      // 不能让 metric 写失败掩盖原因
      console.error(`[job-runner] failed to update job_runs row ${id}:`, e.message);
    }
    await meta.end().catch(() => {});
    console.log(
      `[job-runner] ${jobName} ${status} ${durationMs}ms${
        ctx.itemsTotal != null ? ` items=${ctx.itemsOk ?? 0}/${ctx.itemsTotal}` : ""
      }${errorMessage ? ` err=${errorMessage}` : ""}`,
    );
  }

  if (thrown) throw thrown;
}
