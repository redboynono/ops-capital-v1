import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { listBookmarks, listHistory } from "@/lib/me";

export const dynamic = "force-dynamic";

type TabKey = "bookmarks" | "history";

function hrefFor(kind: "analysis" | "news", slug: string) {
  return kind === "news" ? `/news/${slug}` : `/analysis/${slug}`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const lib = getDictionary(locale).memberPages.library;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";

  const { tab } = await searchParams;
  const active: TabKey = tab === "history" ? "history" : "bookmarks";

  const [bookmarks, history] = await Promise.all([listBookmarks(user.id, 100), listHistory(user.id, 100)]);
  const items = active === "bookmarks" ? bookmarks : history;

  const tabClass = (key: TabKey) =>
    `px-3 py-1.5 text-[13px] font-semibold border-b-2 -mb-px ${
      active === key ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-foreground"
    }`;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <header className="mb-3 border-b border-border pb-3">
        <span className="label-caps">{lib.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{lib.title}</h1>
      </header>

      <div className="flex items-center border-b border-border">
        <Link href="/dashboard/library?tab=bookmarks" className={tabClass("bookmarks")}>
          {fmt(lib.tabBookmarksFmt, { n: bookmarks.length })}
        </Link>
        <Link href="/dashboard/library?tab=history" className={tabClass("history")}>
          {fmt(lib.tabHistoryFmt, { n: history.length })}
        </Link>
      </div>

      <section className="card mt-3">
        {items.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-muted">
            {active === "bookmarks" ? lib.emptyBookmarks : lib.emptyHistory}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const dateIso = "bookmarked_at" in item ? item.bookmarked_at : item.read_at;
              return (
                <li key={item.post_id} className="row-hover">
                  <Link
                    href={hrefFor(item.kind, item.slug)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {item.kind === "news" ? lib.kindNews : lib.kindAnalysis}
                        {item.is_premium ? " · PRO" : ""} · {new Date(dateIso).toLocaleString(dateLocale)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-accent-strong">{lib.readLink}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
