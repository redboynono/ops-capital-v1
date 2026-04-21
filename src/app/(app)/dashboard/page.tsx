import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getMemberStats, listBookmarks, listHistory } from "@/lib/me";
import { listPosts } from "@/lib/posts";
import { listWatchlist } from "@/lib/tickers";

export const dynamic = "force-dynamic";

function hrefFor(kind: "analysis" | "news", slug: string) {
  return kind === "news" ? `/news/${slug}` : `/analysis/${slug}`;
}

function daysLeft(end: string | null | undefined) {
  if (!end) return null;
  const t = new Date(end).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [stats, bookmarks, history, latest, watchlist] = await Promise.all([
    getMemberStats(user.id),
    listBookmarks(user.id, 5),
    listHistory(user.id, 5),
    listPosts({ kind: "analysis", limit: 5 }),
    listWatchlist(user.id),
  ]);

  const subscribed = user.subscriptionStatus === "active";
  const left = subscribed ? daysLeft(user.subscriptionEndDate) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="label-caps">会员桌面</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">欢迎回来</h1>
          <p className="mt-1 text-[13px] text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-muted">
          <Link href="/dashboard/watchlist" className="hover:text-accent-strong">自选股</Link>
          <span>·</span>
          <Link href="/dashboard/library" className="hover:text-accent-strong">收藏/历史</Link>
          <span>·</span>
          <Link href="/dashboard/profile" className="hover:text-accent-strong">资料</Link>
        </div>
      </header>

      {/* 订阅状态条 */}
      <section
        className="card flex flex-wrap items-center justify-between gap-3 p-4"
        style={subscribed ? { background: "var(--accent-soft)", borderColor: "#f6c7b6" } : {}}
      >
        <div>
          <p className="label-caps">订阅状态</p>
          <p className="mt-0.5 text-lg font-bold">
            {subscribed ? `Premium 会员${left !== null ? ` · 剩余 ${left} 天` : ""}` : "尚未订阅"}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {subscribed
              ? "Premium 分析完整内容 + 估值模型 + 每周备忘录已开启。"
              : "订阅后解锁完整 Premium 分析、估值模型与每周备忘录。"}
          </p>
        </div>
        <div className="flex gap-2">
          {subscribed ? null : (
            <Link href="/pricing" className="btn-primary px-3 py-1.5 text-[12px]">
              查看订阅方案
            </Link>
          )}
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            浏览分析
          </Link>
        </div>
      </section>

      {/* 关键指标 */}
      <section className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <p className="label-caps">本周新分析</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.newThisWeek}</p>
        </div>
        <div className="card p-3">
          <p className="label-caps">我的收藏</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.bookmarks}</p>
        </div>
        <div className="card p-3">
          <p className="label-caps">累计阅读</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.readCount}</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* 左：近期阅读 + 收藏 */}
        <div className="space-y-4">
          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">近期阅读</p>
              <Link href="/dashboard/library?tab=history" className="text-[12px] text-accent-strong hover:underline">
                查看全部 →
              </Link>
            </header>
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">还没有阅读记录。</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.post_id} className="row-hover flex items-center justify-between gap-3 px-4 py-2">
                    <Link href={hrefFor(h.kind, h.slug)} className="link-title truncate text-[13px]">
                      {h.title}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted">
                      {new Date(h.read_at).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">我的收藏</p>
              <Link href="/dashboard/library?tab=bookmarks" className="text-[12px] text-accent-strong hover:underline">
                查看全部 →
              </Link>
            </header>
            {bookmarks.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                暂无收藏。在分析详情页点击收藏按钮即可。
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {bookmarks.map((b) => (
                  <li key={b.post_id} className="row-hover flex items-center justify-between gap-3 px-4 py-2">
                    <Link href={hrefFor(b.kind, b.slug)} className="link-title truncate text-[13px]">
                      {b.title}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted">
                      {new Date(b.bookmarked_at).toLocaleDateString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 右：自选股 + 最新分析 */}
        <div className="space-y-4">
          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">自选股</p>
              <Link href="/dashboard/watchlist" className="text-[12px] text-accent-strong hover:underline">
                管理 →
              </Link>
            </header>
            {watchlist.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                未添加自选。去
                <Link href="/dashboard/watchlist" className="mx-1 text-accent-strong hover:underline">
                  自选股
                </Link>
                添加代码。
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {watchlist.slice(0, 8).map((t) => (
                  <li key={t.symbol} className="row-hover px-4 py-1.5">
                    <Link href={`/t/${t.symbol}`} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-mono font-semibold text-accent-strong">{t.symbol}</span>
                      <span className="truncate text-[12px] text-muted">{t.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">最新分析</p>
              <Link href="/analysis" className="text-[12px] text-accent-strong hover:underline">全部 →</Link>
            </header>
            {latest.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">暂无。</p>
            ) : (
              <ul className="divide-y divide-border">
                {latest.map((p) => (
                  <li key={p.id} className="row-hover px-4 py-2">
                    <Link href={`/analysis/${p.slug}`} className="link-title block text-[13px] leading-snug">
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {p.is_premium ? "PRO · " : ""}
                      {new Date(p.created_at).toLocaleDateString("zh-CN")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
