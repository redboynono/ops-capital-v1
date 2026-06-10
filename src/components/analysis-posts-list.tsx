import { PostRow } from "@/components/post-row";
import { getCachedPosts } from "@/lib/cached-data";
import { getDictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Locale } from "@/lib/i18n/locale-types";
import type { PostPeriod } from "@/lib/posts";

const PAGE_SIZE = 40;

export async function AnalysisPostsList({
  symbol,
  symbols,
  sector,
  period,
  locale,
}: {
  symbol?: string;
  symbols?: string[];
  sector?: string;
  period?: PostPeriod;
  locale: Locale;
}) {
  const t = getDictionary(locale).analysis;
  const posts = await getCachedPosts({
    kind: "analysis",
    limit: PAGE_SIZE,
    symbol,
    symbols,
    sector,
    period,
  });

  if (posts.length === 0) {
    return <p className="py-16 text-center text-[13px] text-muted">{t.noPosts}</p>;
  }

  return (
    <>
      {posts.map((p) => (
        <PostRow key={p.id} post={p} locale={locale} />
      ))}
      {posts.length >= PAGE_SIZE ? (
        <p className="border-t border-border py-3 text-center text-[12px] text-muted">
          {fmt(t.listFooterFmt, { n: PAGE_SIZE })}
        </p>
      ) : null}
    </>
  );
}
