import Link from "next/link";
import { ShareButton } from "@/components/share/share-button";
import { formatRelative } from "@/lib/i18n/common";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locale-types";
import { postExcerpt, postTitle } from "@/lib/i18n/post-locale";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";

type Post = {
  id: string;
  title: string;
  title_en?: string | null;
  slug: string;
  kind: "analysis" | "news";
  excerpt?: string | null;
  excerpt_en?: string | null;
  is_premium: number | boolean;
  created_at: string;
  tickers?: string[];
};

export function PostRow({
  post,
  dense = false,
  locale = "zh",
  showShare = false,
}: {
  post: Post;
  dense?: boolean;
  locale?: Locale;
  showShare?: boolean;
}) {
  const dict = getDictionary(locale);
  const href = post.kind === "news" ? `/news/${post.slug}` : `/analysis/${post.slug}`;
  const premium = !!post.is_premium;
  const title = postTitle(post, locale);
  const excerpt = postExcerpt(post, locale);

  return (
    <article className={`row-hover border-b border-border py-3 ${dense ? "text-[13px]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {premium ? (
              <span className="badge-premium">
                {post.kind === "analysis" ? "Research" : "PRO"}
              </span>
            ) : (
              <span className="badge-free">{dict.common.public}</span>
            )}
            {post.tickers?.slice(0, 3).map((s) => (
              <Link key={s} href={`/t/${encodeURIComponent(normalizeInternalSymbol(s))}`} className="chip">
                {s}
              </Link>
            ))}
            <span className="label-caps">{formatRelative(locale, post.created_at, dict.common)}</span>
          </div>

          <Link href={href} className="link-title mt-1 block text-[15px] leading-snug">
            {title}
          </Link>

          {!dense && excerpt ? (
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{excerpt}</p>
          ) : null}
        </div>

        {showShare ? (
          <ShareButton
            variant="icon-compact"
            data={{
              type: "post",
              kind: post.kind,
              title,
              excerpt,
              tickers: post.tickers,
              createdAt: post.created_at,
            }}
            urlPath={href}
            fileNamePrefix={`ops_alpha_${post.slug}`}
          />
        ) : null}
      </div>
    </article>
  );
}
