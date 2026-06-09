import Link from "next/link";
import { getCachedPosts } from "@/lib/cached-data";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";

const PAGE_SIZE = 50;

function formatListTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export async function NewsPostsList({
  symbol,
  symbols,
}: {
  symbol?: string;
  symbols?: string[];
}) {
  const items = await getCachedPosts({
    kind: "news",
    limit: PAGE_SIZE,
    symbol,
    symbols,
  });

  if (items.length === 0) {
    return <p className="py-16 text-center text-[13px] text-muted">暂无快讯。</p>;
  }

  return (
    <>
      <ol className="sa-list">
        {items.map((n) => (
          <li key={n.id}>
            <div className="flex flex-wrap items-center gap-2">
              {n.tickers?.slice(0, 3).map((s) => (
                <Link key={s} href={`/t/${encodeURIComponent(normalizeInternalSymbol(s))}`} className="chip">
                  {s}
                </Link>
              ))}
              <span className="label-caps">{formatListTime(n.created_at)}</span>
            </div>
            <Link href={`/news/${n.slug}`} className="link-title mt-1 block text-[15px] leading-snug">
              {n.title}
            </Link>
            {n.excerpt ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{n.excerpt}</p>
            ) : null}
          </li>
        ))}
      </ol>
      {items.length >= PAGE_SIZE ? (
        <p className="border-t border-border py-3 text-center text-[12px] text-muted">
          已显示最近 {PAGE_SIZE} 条 ·{symbol ? " 可清除筛选查看更多" : " 按标的筛选可缩小范围"}
        </p>
      ) : null}
    </>
  );
}
