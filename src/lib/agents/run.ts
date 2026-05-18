/**
 * runAgent — 编排 buildContext → 调 LLM stream → 落库 agent_runs
 * 给 /api/agents/run 用；以后 /workbench 也用同一个出口。
 */

import { randomUUID } from "node:crypto";

import { getAIConfig, proxyChatCompletionStream } from "@/lib/ai/stream";
import {
  type AgentDefinition,
  type AgentInput,
} from "@/lib/agents/registry";
import { mysqlQuery } from "@/lib/mysql";
import { logEvent } from "@/lib/observability";

export type RunAgentOptions = {
  agent: AgentDefinition;
  input: AgentInput;
  userId: string;
};

/**
 * 主入口：构建 context、写一行 running 的 agent_runs、调 LLM stream、流式回客户端，
 * 流式结束（或失败）后回填 agent_runs。
 *
 * 返回 streaming Response，调用方直接 return 给客户端。
 */
export async function runAgent(opts: RunAgentOptions): Promise<Response> {
  const { agent, input, userId } = opts;

  const ai = getAIConfig();
  if (!ai) {
    return Response.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  // ---- 1. 构建 context ----
  let built: { context: string; meta?: Record<string, unknown> };
  try {
    built = await agent.buildContext(input, { userId });
  } catch (err) {
    return Response.json(
      {
        error: "context build failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  const { context, meta } = built;
  const userContent = agent.userPromptTemplate.replace("{context}", context);

  // ---- 2. 落 running 行 ----
  const runId = randomUUID();
  const startedAt = new Date();
  const inputSymbol =
    input.kind === "ticker" ? input.symbol.toUpperCase().slice(0, 32) : null;
  const inputSlug = input.kind === "post" ? input.slug.slice(0, 160) : null;
  const inputQuery = input.kind === "freeform" ? input.query.slice(0, 500) : null;

  try {
    await mysqlQuery(
      `insert into agent_runs (
         id, user_id, agent_id, agent_name, input_kind, input_symbol, input_slug, input_query,
         status, context_len, started_at, meta_json
       ) values (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
      [
        runId,
        userId,
        agent.id,
        agent.name,
        input.kind,
        inputSymbol,
        inputSlug,
        inputQuery,
        context.length,
        startedAt,
        meta ? JSON.stringify(meta) : null,
      ],
    );
  } catch (err) {
    // observability 失败也不阻塞用户
    console.warn(`[agents] failed to insert agent_runs row:`, (err as Error).message);
  }

  // 行为埋点
  logEvent("agent_run", {
    userId,
    symbol: inputSymbol,
    meta: { agentId: agent.id, runId, contextLen: context.length },
  });

  // ---- 3. 调 LLM stream ----
  return proxyChatCompletionStream({
    apiKey: ai.apiKey,
    baseUrl: ai.baseUrl,
    model: ai.model,
    temperature: 0.3,
    maxTokens: agent.maxTokens ?? 8000,
    messages: [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userContent },
    ],

    onComplete: async (full) => {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      try {
        await mysqlQuery(
          `update agent_runs
              set status = 'ok', output_md = ?, output_len = ?, duration_ms = ?, finished_at = ?
            where id = ?`,
          [full, full.length, durationMs, finishedAt, runId],
        );
      } catch (err) {
        console.warn(
          `[agents] failed to finalize agent_runs row ${runId}:`,
          (err as Error).message,
        );
      }
    },

    onError: async (err) => {
      const finishedAt = new Date();
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      try {
        await mysqlQuery(
          `update agent_runs
              set status = 'failed', error_message = ?, duration_ms = ?, finished_at = ?
            where id = ?`,
          [err.message.slice(0, 990), durationMs, finishedAt, runId],
        );
      } catch (e) {
        console.warn(
          `[agents] failed to mark agent_runs failed ${runId}:`,
          (e as Error).message,
        );
      }
    },
  });
}

// ============================================================
// 历史查询（给 /api/agents/runs 用）
// ============================================================

export type AgentRunSummary = {
  id: string;
  agent_id: string;
  agent_name: string;
  input_kind: "ticker" | "post" | "freeform";
  input_symbol: string | null;
  input_slug: string | null;
  status: "running" | "ok" | "failed" | "cancelled";
  output_len: number | null;
  duration_ms: number | null;
  started_at: string;
};

export async function listUserRuns(
  userId: string,
  opts: { limit?: number; symbol?: string | null } = {},
): Promise<AgentRunSummary[]> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const args: unknown[] = [userId];
  let where = "where user_id = ?";
  if (opts.symbol) {
    where += " and input_symbol = ?";
    args.push(opts.symbol.toUpperCase());
  }
  const rows = await mysqlQuery<
    Array<{
      id: string;
      agent_id: string;
      agent_name: string;
      input_kind: AgentRunSummary["input_kind"];
      input_symbol: string | null;
      input_slug: string | null;
      status: AgentRunSummary["status"];
      output_len: number | null;
      duration_ms: number | null;
      started_at: Date;
    }>
  >(
    `select id, agent_id, agent_name, input_kind, input_symbol, input_slug,
            status, output_len, duration_ms, started_at
       from agent_runs
       ${where}
       order by started_at desc
       limit ?`,
    [...args, limit],
  );
  return rows.map((r) => ({
    ...r,
    started_at: new Date(r.started_at).toISOString(),
  }));
}

export async function getUserRun(userId: string, runId: string) {
  const rows = await mysqlQuery<
    Array<{
      id: string;
      user_id: string;
      agent_id: string;
      agent_name: string;
      input_kind: "ticker" | "post" | "freeform";
      input_symbol: string | null;
      input_slug: string | null;
      input_query: string | null;
      status: "running" | "ok" | "failed" | "cancelled";
      output_md: string | null;
      context_len: number | null;
      output_len: number | null;
      duration_ms: number | null;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
      meta_json: string | null;
    }>
  >(
    `select id, user_id, agent_id, agent_name, input_kind, input_symbol, input_slug, input_query,
            status, output_md, context_len, output_len, duration_ms, error_message,
            started_at, finished_at, meta_json
       from agent_runs
       where user_id = ? and id = ?
       limit 1`,
    [userId, runId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    started_at: new Date(r.started_at).toISOString(),
    finished_at: r.finished_at ? new Date(r.finished_at).toISOString() : null,
  };
}
