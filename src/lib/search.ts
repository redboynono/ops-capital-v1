import { mysqlQuery } from "@/lib/mysql";

export type SearchTickerHit = {
  symbol: string;
  name: string;
  exchange: string;
};

export type SearchPostHit = {
  id: string;
  title: string;
  slug: string;
  kind: "analysis" | "news";
  excerpt: string;
  created_at: string;
};

export type SearchResults = {
  tickers: SearchTickerHit[];
  posts: SearchPostHit[];
};

function normalizeQuery(q: string) {
  return q.trim().slice(0, 80);
}

export async function globalSearch(raw: string, limit = 12): Promise<SearchResults> {
  const q = normalizeQuery(raw);
  if (q.length < 1) return { tickers: [], posts: [] };

  const sym = q.toUpperCase().replace(/\s+/g, "");
  const like = `%${q}%`;

  const tickers = await mysqlQuery<SearchTickerHit[]>(
    `select symbol, name, exchange from tickers
      where symbol like ? or name like ?
      order by
        case when symbol = ? then 0 when symbol like ? then 1 else 2 end,
        symbol
      limit ?`,
    [like, like, sym, `${sym}%`, limit],
  );

  const posts = await mysqlQuery<SearchPostHit[]>(
    `select id, title, slug, kind, excerpt, created_at from posts
      where is_published = 1
        and (title like ? or excerpt like ? or content like ?)
      order by created_at desc
      limit ?`,
    [like, like, like, limit],
  );

  return { tickers, posts };
}
