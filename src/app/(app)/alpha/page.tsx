import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketSnapshot } from "@/components/market-snapshot";
import { PostRow } from "@/components/post-row";
import { ExpiringOptionsDirectSignals } from "@/components/expiring-options-direct-signals";
import { thisFridayIso } from "@/lib/options-expiry";
import { RatingChangesPanel } from "@/components/rating-changes-panel";
import { TopRatedPanel } from "@/components/top-rated";
import { getCachedPosts } from "@/lib/cached-data";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { postTitle } from "@/lib/i18n/post-locale";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/alpha");

  const locale = await getLocale();
  const t = getDictionary(locale);
  const a = t.alpha;

  const [analysis, news] = await Promise.all([
    getCachedPosts({ kind: "analysis", limit: 10 }),
    getCachedPosts({ kind: "news", limit: 10 }),
  ]);

  const dateLocale = locale === "en" ? "en-US" : "zh-CN";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <MarketSnapshot dict={t} />

      <div className="mt-5">
        <ExpiringOptionsDirectSignals
          compact
          underlyings={["SPY", "QQQ"]}
          expirationDate={thisFridayIso()}
          expiryLabel={a.expiryThisFriday}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TopRatedPanel limit={6} />
        <RatingChangesPanel limit={8} sinceHours={72} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">{a.analysisTitle}</h2>
              <p className="text-[11px] text-muted">{a.analysisSub}</p>
            </div>
            <Link href="/analysis" className="text-[12px] font-semibold text-accent-strong hover:underline">
              {a.viewAll}
            </Link>
          </header>
          <div className="px-4">
            {analysis.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">
                {a.noAnalysis}
                <Link href="/admin/editor" className="mx-1 text-accent-strong hover:underline">
                  {a.editor}
                </Link>
                {a.noAnalysisEnd}
              </p>
            ) : (
              analysis.map((p) => <PostRow key={p.id} post={p} locale={locale} />)
            )}
          </div>
        </section>

        <section className="card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">{a.newsTitle}</h2>
              <p className="text-[11px] text-muted">{a.newsSub}</p>
            </div>
            <Link href="/news" className="text-[12px] font-semibold text-accent-strong hover:underline">
              {a.allNews}
            </Link>
          </header>
          <div className="px-4 py-1">
            {news.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">{a.noNews}</p>
            ) : (
              <ol className="sa-list">
                {news.map((n) => (
                  <li key={n.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      {n.tickers?.slice(0, 3).map((s) => (
                        <Link key={s} href={`/t/${s}`} className="chip">
                          {s}
                        </Link>
                      ))}
                      <span className="label-caps">
                        {new Date(n.created_at).toLocaleString(dateLocale, {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Link href={`/news/${n.slug}`} className="link-title mt-1 block text-[14px] leading-snug">
                      {postTitle(n, locale)}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-foreground">{a.researchProTitle}</h3>
            <p className="mt-0.5 text-[12px] text-muted">{a.researchProSub}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/pricing?product=research" className="btn-primary px-3 py-1.5 text-[12px]">
              {a.subscribeResearch}
            </Link>
            <Link href="/login?tab=signup" className="btn-outline px-3 py-1.5 text-[12px]">
              {a.freeSignup}
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-soft">{a.disclaimer}</p>
    </div>
  );
}
