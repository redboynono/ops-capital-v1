import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { listUserRuns } from "@/lib/agents/run";
import { getAgent } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我的 Agent 运行 · OPS Alpha",
  description: "你过去派 AI Agent 跑过的所有任务",
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ok: { label: "完成", cls: "bg-[color:var(--success)]/15 text-[color:var(--success)]" },
  running: { label: "进行中", cls: "bg-accent/15 text-accent-strong" },
  failed: { label: "失败", cls: "bg-[color:var(--danger)]/15 text-[color:var(--danger)]" },
  cancelled: { label: "已停", cls: "bg-surface-muted text-muted" },
};

function fmtIso(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AgentRunsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/agent-runs");

  const runs = await listUserRuns(user.id, { limit: 50 });

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">My Agent Runs</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">我的 Agent 运行历史</h1>
        <p className="mt-1 text-[13px] text-muted">
          过去派 AI Agent 跑过的全部任务。点击一行可重读完整输出。
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-muted">
          <p>还没有 Agent 运行记录。</p>
          <p className="mt-2">
            去任何一只标的页（比如{" "}
            <Link href="/t/NVDA" className="text-accent-strong hover:underline">
              /t/NVDA
            </Link>
            ），选一个 Agent 卡片来运行第一个吧。
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {runs.map((r) => {
            const agent = getAgent(r.agent_id);
            const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.ok;
            return (
              <Link
                key={r.id}
                href={`/dashboard/agent-runs/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted"
              >
                <span className="text-xl shrink-0">{agent?.emoji ?? "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-[13px] font-bold text-foreground truncate">
                      {r.agent_name}
                    </h3>
                    {r.input_symbol ? (
                      <span className="mono text-[11px] text-accent-strong">
                        {r.input_symbol}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {fmtIso(r.started_at)} · {fmtDuration(r.duration_ms)}
                    {r.output_len ? ` · ${r.output_len} chars` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold ${status.cls}`}
                >
                  {status.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-soft">
        最多展示最近 50 条；老的记录会保留在数据库中。
      </p>
    </div>
  );
}
