"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";

import { useDict } from "@/components/locale-provider";
import { fmt } from "@/lib/i18n/fmt";
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

export function AgentLauncher({
  symbol,
  agents,
  loggedIn,
}: {
  symbol: string;
  agents: AgentCardData[];
  loggedIn: boolean;
}) {
  const a = useDict().agentUi;
  const loginLabel = useDict().paywall.login;
  const [active, setActive] = useState<ActiveRun[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const categories = a.categories as Record<string, string>;

  function launch(agent: AgentCardData) {
    if (!loggedIn) return;
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
          <span className="label-caps">{a.label}</span>
          <h2 className="mt-1 text-[15px] font-bold text-foreground">
            {fmt(a.titleFmt, { symbol })}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">{a.subtitle}</p>
        </div>
        <Link
          href="/dashboard/agent-runs"
          className="text-[11px] text-muted hover:text-accent-strong"
        >
          {a.history}
        </Link>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => launch(agent)}
            disabled={!loggedIn}
            className="group flex h-full flex-col items-start rounded-sm border border-border bg-surface p-3 text-left transition hover:border-accent hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-lg">{agent.emoji}</span>
              <span className="mono text-[9px] uppercase tracking-wider text-muted">
                {categories[agent.category] ?? agent.category}
              </span>
            </div>
            <h3 className="mt-2 text-[13px] font-bold text-foreground group-hover:text-accent-strong">
              {agent.name}
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{agent.short}</p>
            <div className="mt-2 flex w-full items-center justify-between text-[10px] text-muted-soft">
              <span className="mono">~{agent.estimatedSeconds}s</span>
              {loggedIn ? (
                <span className="inline-flex items-center gap-1 text-accent-strong">
                  <Sparkles className="h-3 w-3" />
                  {a.run}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {a.loginRequired}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!loggedIn ? (
        <p className="mt-2 text-[11px] text-muted">
          <Link href="/login" className="text-accent-strong hover:underline">
            {loginLabel}
          </Link>{" "}
          {a.loginHint}
        </p>
      ) : null}

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
