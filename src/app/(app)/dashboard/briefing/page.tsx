import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getSessionUser } from "@/lib/auth";
import { listBriefingsForUser, type BriefingRow } from "@/lib/briefings";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { listWatchlist } from "@/lib/tickers";

export const dynamic = "force-dynamic";

function fmtDate(iso: string, weekdays: string[]): string {
  const d = new Date(iso + "T12:00:00Z");
  const md = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  const week = weekdays[d.getUTCDay()];
  return `${md} ${week}`;
}

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const b = getDictionary(locale).memberPages.briefing;

  const sp = await searchParams;
  const [briefings, watchlist] = await Promise.all([
    listBriefingsForUser(user.id, 30),
    listWatchlist(user.id),
  ]);

  const selected: BriefingRow | undefined =
    (sp.d ? briefings.find((b) => b.brief_date === sp.d) : undefined) ?? briefings[0];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{b.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{b.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{b.subtitle}</p>
      </header>

      {watchlist.length === 0 ? (
        <EmptyWatchlist b={b} />
      ) : briefings.length === 0 ? (
        <EmptyBriefings b={b} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <aside className="card p-2 h-fit">
            <p className="label-caps mb-2 px-1 text-[10px]">{b.history}</p>
            <ul className="space-y-0.5">
              {briefings.map((row) => {
                const active = selected?.id === row.id;
                return (
                  <li key={row.id}>
                    <Link
                      href={`/dashboard/briefing?d=${row.brief_date}`}
                      className={`flex items-center justify-between rounded px-2 py-1.5 mono text-[12px] ${
                        active
                          ? "bg-accent/15 text-accent-strong"
                          : "text-foreground-soft hover:bg-surface-muted"
                      }`}
                    >
                      <span>{fmtDate(row.brief_date, b.weekdays)}</span>
                      <span className="text-[10px] text-muted">{row.ticker_count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>

          <article className="card p-5">
            {selected ? (
              <>
                <header className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
                  <p className="mono text-[12px] text-muted">
                    {fmt(b.headerFmt, { date: selected.brief_date, n: selected.ticker_count })}
                  </p>
                  {selected.email_sent_at ? (
                    <p className="text-[10px] text-muted">{b.emailSent}</p>
                  ) : null}
                </header>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selected.content_markdown}
                  </ReactMarkdown>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-muted">{b.noneSelected}</p>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

function EmptyWatchlist({ b }: { b: ReturnType<typeof getDictionary>["memberPages"]["briefing"] }) {
  return (
    <div className="card px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-2 text-[16px] font-semibold text-foreground">{b.emptyWatchlistTitle}</p>
      <p>
        {b.emptyWatchlistBody}{" "}
        <Link href="/tickers" className="text-accent-strong hover:underline">
          {b.tickersLink}
        </Link>{" "}
        {b.orLink}{" "}
        <Link href="/screener" className="text-accent-strong hover:underline">
          {b.screenerLink}
        </Link>{" "}
        {b.emptyWatchlistEnd}
      </p>
    </div>
  );
}

function EmptyBriefings({ b }: { b: ReturnType<typeof getDictionary>["memberPages"]["briefing"] }) {
  return (
    <div className="card px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-1 text-[16px] font-semibold text-foreground">{b.emptyBriefingTitle}</p>
      <p>{b.emptyBriefingBody}</p>
      <p className="mt-3 text-[11px]">
        {b.adminHint}{" "}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 mono">
          node /app/daily-briefing.mjs --user=&lt;email&gt;
        </code>
      </p>
    </div>
  );
}
