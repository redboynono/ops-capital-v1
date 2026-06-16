"use client";

/**
 * AgentRunner — 共享的 Agent 执行 + 流式渲染面板。
 *
 * 用法：
 *   <AgentRunner
 *     agentId="dcf-valuation"
 *     agentName="DCF 估值速算"
 *     emoji="📊"
 *     payload={{ symbol: "NVDA" }}     // 传给 /api/agents/run
 *     onClose={() => ...}
 *   />
 *
 * 自动：
 *   - POST /api/agents/run，解析流式 plain-text 增量
 *   - 实时渲染 Markdown（流式期间用 pre 防止半截 markdown 失效，结束后切到 Markdown 渲染）
 *   - 失败显示原因，提供重试
 */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Loader2, RefreshCcw, Sparkles, X } from "lucide-react";

export type AgentRunPayload = {
  symbol?: string;
  slug?: string;
  query?: string;
};

export function AgentRunner({
  agentId,
  agentName,
  emoji,
  description,
  payload,
  onClose,
  autoStart = true,
}: {
  agentId: string;
  agentName: string;
  emoji: string;
  description?: string;
  payload: AgentRunPayload;
  onClose?: () => void;
  autoStart?: boolean;
}) {
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "ok" | "failed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);

  // 计时器
  useEffect(() => {
    if (status !== "streaming") return;
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current);
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [status]);

  async function run() {
    if (status === "streaming") return;
    setOutput("");
    setError(null);
    setStatus("streaming");
    startedAtRef.current = Date.now();
    setElapsedMs(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, ...payload }),
        signal: ctrl.signal,
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      setStatus("ok");
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("failed");
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      abortRef.current = null;
    }
  }

  function abort() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  // autoStart：第一次 mount 自动跑一次
  useEffect(() => {
    if (autoStart) run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card mt-3">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{emoji}</span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-foreground truncate">{agentName}</h3>
            {description ? (
              <p className="text-[10px] text-muted truncate">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === "streaming" ? (
            <span className="inline-flex items-center gap-1 mono text-[10px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {status === "ok" ? (
            <span className="inline-flex items-center mono text-[10px] text-[color:var(--success)]">
              ✓ {(elapsedMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {status === "streaming" ? (
            <button
              type="button"
              onClick={abort}
              className="inline-flex h-6 items-center rounded-sm border border-border px-1.5 text-[10px] text-muted hover:text-foreground hover:border-accent"
              title="中断"
            >
              停
            </button>
          ) : null}
          {(status === "ok" || status === "failed") ? (
            <button
              type="button"
              onClick={run}
              className="inline-flex h-6 items-center gap-1 rounded-sm border border-border px-1.5 text-[10px] text-muted hover:text-accent-strong hover:border-accent"
              title="重新生成"
            >
              <RefreshCcw className="h-3 w-3" />
              重跑
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:text-foreground hover:bg-surface-muted"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-2 px-3 py-3 text-[12px] text-[color:var(--danger)]">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="px-4 py-3">
        {status === "streaming" && !output ? (
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent-strong" />
            <span>Agent 正在调度数据 + 推理…</span>
          </div>
        ) : null}

        {output ? (
          status === "streaming" ? (
            // 流式期间：用 mono pre 显示，避免半截 markdown 闪烁
            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-soft font-sans">
              {output}
              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent-strong" />
            </pre>
          ) : (
            <article className="prose prose-sm prose-invert max-w-none agent-output">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            </article>
          )
        ) : null}

        {status === "idle" && !output ? (
          <button
            type="button"
            onClick={run}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-accent bg-accent/10 px-3 text-[12px] font-bold text-accent-strong hover:bg-accent/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            运行 Agent
          </button>
        ) : null}
      </div>
    </section>
  );
}
