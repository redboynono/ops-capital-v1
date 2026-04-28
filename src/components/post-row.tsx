import Link from "next/link";
import { ShareButton } from "@/components/share/share-button";

type Post = {
  id: string;
  title: string;
  slug: string;
  kind: "analysis" | "news";
  excerpt?: string;
  is_premium: number | boolean;
  created_at: string;
  tickers?: string[];
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function PostRow({ post, dense = false }: { post: Post; dense?: boolean }) {
  const href = post.kind === "news" ? `/news/${post.slug}` : `/analysis/${post.slug}`;
  const premium = !!post.is_premium;

  return (
    <article className={`row-hover border-b border-border py-3 ${dense ? "text-[13px]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {premium ? (
              <span className="badge-premium">PRO</span>
            ) : (
              <span className="badge-free">公开</span>
            )}
            {post.tickers?.slice(0, 3).map((s) => (
              <Link key={s} href={`/t/${s}`} className="chip">
                {s}
              </Link>
            ))}
            <span className="label-caps">{formatRelative(post.created_at)}</span>
          </div>

          <Link href={href} className="link-title mt-1 block text-[15px] leading-snug">
            {post.title}
          </Link>

          {!dense && post.excerpt ? (
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{post.excerpt}</p>
          ) : null}
        </div>

        <ShareButton
          variant="icon-compact"
          data={{
            type: "post",
            kind: post.kind,
            title: post.title,
            excerpt: post.excerpt,
            tickers: post.tickers,
            createdAt: post.created_at,
          }}
          urlPath={href}
          fileNamePrefix={`ops_alpha_${post.slug}`}
        />
      </div>
    </article>
  );
}
