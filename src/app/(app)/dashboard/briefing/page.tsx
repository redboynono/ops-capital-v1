import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getSessionUser } from "@/lib/auth";
import { listBriefingsForUser, type BriefingRow } from "@/lib/briefings";
import { listWatchlist } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "每日简报 · OPS Alpha",
};

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const md = `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getUTCDay()];
  return `${md} ${week}`;
}

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const [briefings, watchlist] = await Promise.all([
    listBriefingsForUser(user.id, 30),
    listWatchlist(user.id),
  ]);

  // 选中要展示的简报：URL ?d=YYYY-MM-DD 或最新一份
  const selected: BriefingRow | undefined =
    (sp.d ? briefings.find((b) => b.brief_date === sp.d) : undefined) ?? briefings[0];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Briefing</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">每日简报</h1>
        <p className="mt-1 text-[13px] text-muted">
          基于你的自选股自动汇总：隔夜涨跌 / 24h news / 未来 7 天财报 / OPS Alpha 新文章
        </p>
      </header>

      {watchlist.length === 0 ? (
        <EmptyWatchlist />
      ) : briefings.length === 0 ? (
        <EmptyBriefings />
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          {/* 历史列表 */}
          <aside className="card p-2 h-fit">
            <p className="label-caps mb-2 px-1 text-[10px]">历史</p>
            <ul className="space-y-0.5">
              {briefings.map((b) => {
                const active = selected?.id === b.id;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/dashboard/briefing?d=${b.brief_date}`}
                      className={`flex items-center justify-between rounded px-2 py-1.5 mono text-[12px] ${
                        active
                          ? "bg-accent/15 text-accent-strong"
                          : "text-foreground-soft hover:bg-surface-muted"
                      }`}
                    >
                      <span>{fmtDate(b.brief_date)}</span>
                      <span className="text-[10px] text-muted">{b.ticker_count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* 主体 */}
          <article className="card p-5">
            {selected ? (
              <>
                <header className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
                  <p className="mono text-[12px] text-muted">
                    {selected.brief_date} · {selected.ticker_count} 个标的
                  </p>
                  {selected.email_sent_at ? (
                    <p className="text-[10px] text-muted">已发送邮件</p>
                  ) : null}
                </header>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selected.content_markdown}
                  </ReactMarkdown>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-muted">未选中任何一份简报。</p>
            )}
          </article>
        </div>
      )}
    </div>
  );
}

function EmptyWatchlist() {
  return (
    <div className="card px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-2 text-[16px] font-semibold text-foreground">还没有添加自选股</p>
      <p>
        简报基于你的自选股生成。先到{" "}
        <Link href="/tickers" className="text-accent-strong hover:underline">
          标的索引
        </Link>{" "}
        或{" "}
        <Link href="/screener" className="text-accent-strong hover:underline">
          选股器
        </Link>{" "}
        添加几只标的。
      </p>
    </div>
  );
}

function EmptyBriefings() {
  return (
    <div className="card px-4 py-12 text-center text-[13px] text-muted">
      <p className="mb-1 text-[16px] font-semibold text-foreground">尚未生成简报</p>
      <p>简报每日北京时间早上 8:30 自动生成；首日加入自选清单后次日即可看到。</p>
      <p className="mt-3 text-[11px]">
        管理员可手动触发：<code className="rounded bg-surface-muted px-1.5 py-0.5 mono">node /app/daily-briefing.mjs --user=&lt;email&gt;</code>
      </p>
    </div>
  );
}
