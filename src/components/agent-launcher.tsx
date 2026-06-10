"use client";

/**
 * AgentLauncher — 在 /t/<symbol> 页展示 6 张 Agent 卡片。
 * 点击 → inline 展开 AgentRunner，自动开始 streaming。
 * 支持同时打开多个 Agent（顺序追加），用户可关闭已完成的。
 *
 * 数据：传入 agents 列表（来自 server side 的 listAgentsByInput("ticker") + 序列化必要字段）
 *      避免把 server-only 的 buildContext 函数泄露到 client。
 */

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";

import { AgentRunner } from "./agent-runner";

export type AgentCardData = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  short: string;
  description: string;
  estimatedSeconds: number;
};

type ActiveRun = {
  key: number;
  agent: AgentCardData;
};

const CATEGORY_LABELS: Record<string, string> = {
  valuation: "估值",
  comparison: "对比",
  narrative: "叙事",
  events: "事件",
  portfolio: "组合",
};

export function AgentLauncher({
  symbol,
  agents,
  loggedIn,
}: {
  symbol: string;
  agents: AgentCardData[];
  loggedIn: boolean;
}) {
  const [active, setActive] = useState<ActiveRun[]>([]);
  const [nextKey, setNextKey] = useState(1);

  function launch(agent: AgentCardData) {
    if (!loggedIn) return;
    // 同 agent 重复点击 → 在最上面新开一个
    const k = nextKey;
    setNextKey((n) => n + 1);
    setActive((cur) => [{ key: k, agent }, ...cur]);
  }

  function close(key: number) {
    setActive((cur) => cur.filter((r) => r.key !== key));
  }

  return (
    <section className="mt-6">
      <header className="mb-3 flex items-end justify-between border-b border-border pb-2">
        <div>
          <span className="label-caps">Agents · 一键调用</span>
          <h2 className="mt-1 text-[15px] font-bold text-foreground">
            派一个 AI Agent 去分析 {symbol}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            每个 Agent 自带数据收集 + 专属 prompt，结果自动存进你的"文档架"。
          </p>
        </div>
        <Link
          href="/dashboard/agent-runs"
          className="text-[11px] text-muted hover:text-accent-strong"
        >
          我的运行历史 →
        </Link>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => launch(a)}
            disabled={!loggedIn}
            className="group flex h-full flex-col items-start rounded-sm border border-border bg-surface p-3 text-left transition hover:border-accent hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-lg">{a.emoji}</span>
              <span className="mono text-[9px] uppercase tracking-wider text-muted">
                {CATEGORY_LABELS[a.category] ?? a.category}
              </span>
            </div>
            <h3 className="mt-2 text-[13px] font-bold text-foreground group-hover:text-accent-strong">
              {a.name}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{a.short}</p>
            <div className="mt-2 flex w-full items-center justify-between text-[10px] text-muted-soft">
              <span className="mono">~{a.estimatedSeconds}s</span>
              {loggedIn ? (
                <span className="inline-flex items-center gap-1 text-accent-strong">
                  <Sparkles className="h-3 w-3" />
                  运行
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  需登录
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!loggedIn ? (
        <p className="mt-2 text-[11px] text-muted">
          <Link href="/login" className="text-accent-strong hover:underline">
            登录
          </Link>{" "}
          后即可一键调用所有 Agent。
        </p>
      ) : null}

      {/* 已激活的 Agent 实例（顺序展开，最新在上） */}
      {active.length > 0 ? (
        <div className="mt-2">
          {active.map((r) => (
            <AgentRunner
              key={r.key}
              agentId={r.agent.id}
              agentName={r.agent.name}
              emoji={r.agent.emoji}
              description={r.agent.description}
              payload={{ symbol }}
              onClose={() => close(r.key)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
