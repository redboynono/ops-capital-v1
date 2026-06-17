import Link from "next/link";
import { getCachedPosts } from "@/lib/cached-data";
import { getDictionary, getLocale } from "@/lib/i18n";
import { postTitle } from "@/lib/i18n/post-locale";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";

const PAGE_SIZE = 50;

function formatListTime(iso: string, locale: "zh" | "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function NewsPostsList({
  symbol,
  symbols,
}: {
  symbol?: string;
  symbols?: string[];
}) {
  const locale = await getLocale();
  const n = getDictionary(locale).news;
  const items = await getCachedPosts({
    kind: "news",
    limit: PAGE_SIZE,
    symbol,
    symbols,
  });

  if (items.length === 0) {
    return <p className="py-16 text-center text-[13px] text-muted">{n.noPosts}</p>;
  }

  return (
    <>
      <ol className="sa-list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              {item.tickers?.slice(0, 3).map((s) => (
                <Link key={s} href={`/t/${encodeURIComponent(normalizeInternalSymbol(s))}`} className="chip">
                  {s}
                </Link>
              ))}
              <span className="label-caps">{formatListTime(item.created_at, locale)}</span>
            </div>
            <Link href={`/news/${item.slug}`} className="link-title mt-1 block text-[15px] leading-snug">
              {postTitle(item, locale)}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
