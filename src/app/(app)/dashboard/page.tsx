import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasOptionAlphaAccess, hasResearchAccess } from "@/lib/entitlements";
import { isSubscriptionActive, subscriptionDaysLeft } from "@/lib/subscription";
import { getMemberStats, listBookmarks, listHistory } from "@/lib/me";
import { getCachedPosts } from "@/lib/cached-data";
import { listWatchlist } from "@/lib/tickers";
import { formatDate } from "@/lib/i18n/common";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { postTitle } from "@/lib/i18n/post-locale";

export const dynamic = "force-dynamic";

function hrefFor(kind: "analysis" | "news", slug: string) {
  return kind === "news" ? `/news/${slug}` : `/analysis/${slug}`;
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const d = getDictionary(locale).dashboard;
  const c = getDictionary(locale).common;

  const [stats, bookmarks, history, latest, watchlist] = await Promise.all([
    getMemberStats(user.id),
    listBookmarks(user.id, 5),
    listHistory(user.id, 5),
    getCachedPosts({ kind: "analysis", limit: 5 }),
    listWatchlist(user.id),
  ]);

  const subscribed = isSubscriptionActive({
    subscriptionStatus: user.subscriptionStatus,
    subscriptionEndDate: user.subscriptionEndDate,
  });
  const left = subscribed ? subscriptionDaysLeft(user.subscriptionEndDate) : null;
  const research = hasResearchAccess(user);
  const options = hasOptionAlphaAccess(user);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="label-caps">{d.label}</span>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{d.welcome}</h1>
          <p className="mt-1 text-[13px] text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-muted">
          <Link href="/dashboard/watchlist" className="hover:text-accent-strong">{d.watchlist}</Link>
          <span>·</span>
          <Link href="/dashboard/library" className="hover:text-accent-strong">{d.library}</Link>
          <span>·</span>
          <Link href="/dashboard/profile" className="hover:text-accent-strong">{d.profile}</Link>
        </div>
      </header>

      <section
        className="card flex flex-wrap items-center justify-between gap-3 p-4"
        style={subscribed ? { background: "var(--accent-soft)", borderColor: "#f6c7b6" } : {}}
      >
        <div>
          <p className="label-caps">{d.subStatus}</p>
          <p className="mt-0.5 text-lg font-bold">
            {subscribed
              ? `${d.subActiveFmt}${left !== null ? fmt(d.daysLeftFmt, { n: left }) : ""}`
              : d.notSubscribed}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {subscribed
              ? fmt(d.entitlementsFmt, {
                  research: research ? "✓" : "—",
                  options: options ? "✓" : "—",
                })
              : d.entitlementsHint}
          </p>
        </div>
        <div className="flex gap-2">
          {subscribed ? null : (
            <Link href="/pricing" className="btn-primary px-3 py-1.5 text-[12px]">
              {d.viewPricing}
            </Link>
          )}
          <Link href="/analysis" className="btn-outline px-3 py-1.5 text-[12px]">
            {d.browseAnalysis}
          </Link>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="card p-3">
          <p className="label-caps">{d.newThisWeek}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.newThisWeek}</p>
        </div>
        <div className="card p-3">
          <p className="label-caps">{d.bookmarks}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.bookmarks}</p>
        </div>
        <div className="card p-3">
          <p className="label-caps">{d.readCount}</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{stats.readCount}</p>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">{d.recentReads}</p>
              <Link href="/dashboard/library?tab=history" className="text-[12px] text-accent-strong hover:underline">
                {c.viewAll}
              </Link>
            </header>
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">{d.noHistory}</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((h) => (
                  <li key={h.post_id} className="row-hover flex items-center justify-between gap-3 px-4 py-2">
                    <Link href={hrefFor(h.kind, h.slug)} className="link-title truncate text-[13px]">
                      {h.title}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatDate(locale, h.read_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">{d.myBookmarks}</p>
              <Link href="/dashboard/library?tab=bookmarks" className="text-[12px] text-accent-strong hover:underline">
                {c.viewAll}
              </Link>
            </header>
            {bookmarks.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">{d.noBookmarks}</p>
            ) : (
              <ul className="divide-y divide-border">
                {bookmarks.map((b) => (
                  <li key={b.post_id} className="row-hover flex items-center justify-between gap-3 px-4 py-2">
                    <Link href={hrefFor(b.kind, b.slug)} className="link-title truncate text-[13px]">
                      {b.title}
                    </Link>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatDate(locale, b.bookmarked_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <header className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="label-caps">{d.watchlistTitle}</p>
              <Link href="/dashboard/watchlist" className="text-[12px] text-accent-strong hover:underline">
                {c.manage}
              </Link>
            </header>
            {watchlist.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                {d.noWatchlist}
                <Link href="/dashboard/watchlist" className="mx-1 text-accent-strong hover:underline">
                  {d.noWatchlistLink}
                </Link>
                {d.noWatchlistEnd}
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
              <p className="label-caps">{d.latestAnalysis}</p>
              <Link href="/analysis" className="text-[12px] text-accent-strong hover:underline">{c.viewAll}</Link>
            </header>
            {latest.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">{c.none}</p>
            ) : (
              <ul className="divide-y divide-border">
                {latest.map((p) => (
                  <li key={p.id} className="row-hover px-4 py-2">
                    <Link href={`/analysis/${p.slug}`} className="link-title block text-[13px] leading-snug">
                      {postTitle(p, locale)}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {p.is_premium ? c.pro : ""}
                      {formatDate(locale, p.created_at)}
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
