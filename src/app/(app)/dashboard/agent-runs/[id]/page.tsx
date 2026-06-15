import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getSessionUser } from "@/lib/auth";
import { getUserRun } from "@/lib/agents/run";
import { getAgent } from "@/lib/agents/registry";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

function fmtIso(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default async function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/dashboard/agent-runs");

  const locale = await getLocale();
  const ar = getDictionary(locale).memberPages.agentRuns;

  const { id } = await params;
  const run = await getUserRun(user.id, id);
  if (!run) notFound();

  const agent = getAgent(run.agent_id);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/dashboard/agent-runs" className="hover:text-accent-strong">
          {ar.back}
        </Link>
      </nav>

      <header className="mt-3 card p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{agent?.emoji ?? "🤖"}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">{run.agent_name}</h1>
            {run.input_symbol ? (
              <p className="mt-1 text-[13px]">
                <Link
                  href={`/t/${run.input_symbol}`}
                  className="mono font-bold text-accent-strong hover:underline"
                >
                  {run.input_symbol}
                </Link>
              </p>
            ) : null}
            {run.input_query ? (
              <p className="mt-1 text-[12px] text-foreground-soft">"{run.input_query}"</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] mono text-muted">
              <span>{fmt(ar.startedFmt, { t: fmtIso(run.started_at) })}</span>
              <span>{fmt(ar.durationFmt, { d: fmtDuration(run.duration_ms) })}</span>
              {run.output_len ? <span>{fmt(ar.outputFmt, { n: run.output_len })}</span> : null}
              {run.context_len ? <span>{fmt(ar.contextFmt, { n: run.context_len })}</span> : null}
              <span
                className={
                  run.status === "ok"
                    ? "text-[color:var(--success)]"
                    : run.status === "failed"
                      ? "text-[color:var(--danger)]"
                      : ""
                }
              >
                {fmt(ar.statusFmt, {
                  s: ar.status[run.status as keyof typeof ar.status] ?? run.status,
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {run.status === "failed" && run.error_message ? (
        <section className="card mt-3 border-[color:var(--danger)]/40 p-3">
          <p className="text-[11px] uppercase tracking-wider text-[color:var(--danger)]">
            {ar.errorTitle}
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-foreground-soft">
            {run.error_message}
          </pre>
        </section>
      ) : null}

      {run.output_md ? (
        <article className="card mt-3 prose prose-sm prose-invert max-w-none p-5 agent-output">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.output_md}</ReactMarkdown>
        </article>
      ) : run.status === "running" ? (
        <p className="card mt-3 p-6 text-center text-[12px] text-muted">{ar.running}</p>
      ) : null}
    </div>
  );
}
