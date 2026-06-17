import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { listUserRuns } from "@/lib/agents/run";
import { getAgent } from "@/lib/agents/registry";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

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

  const locale = await getLocale();
  const ar = getDictionary(locale).memberPages.agentRuns;
  const runs = await listUserRuns(user.id, { limit: 50 });

  const statusCls: Record<string, string> = {
    ok: "bg-[color:var(--success)]/15 text-[color:var(--success)]",
    running: "bg-accent/15 text-accent-strong",
    failed: "bg-[color:var(--danger)]/15 text-[color:var(--danger)]",
    cancelled: "bg-surface-muted text-muted",
  };

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{ar.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{ar.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{ar.subtitle}</p>
      </header>

      {runs.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-muted">
          <p>{ar.empty}</p>
          <p className="mt-2">
            {ar.emptyHint}{" "}
            <Link href="/t/NVDA" className="text-accent-strong hover:underline">
              /t/NVDA
            </Link>
            {ar.emptyHintEnd}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {runs.map((r) => {
            const agent = getAgent(r.agent_id);
            const statusLabel =
              ar.status[r.status as keyof typeof ar.status] ?? ar.status.ok;
            const cls = statusCls[r.status] ?? statusCls.ok;
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
                    {r.output_len ? ` · ${fmt(ar.outputFmt, { n: r.output_len })}` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold ${cls}`}
                >
                  {statusLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-soft">{ar.footerNote}</p>
    </div>
  );
}
