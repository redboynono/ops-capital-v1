import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";

export type PostKind = "analysis" | "news";

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  kind: PostKind;
  excerpt: string;
  content: string;
  is_premium: number;
  is_published: number;
  created_at: string;
  author_id: string | null;
};

export type PostListItem = Pick<
  PostRow,
  "id" | "title" | "slug" | "kind" | "excerpt" | "is_premium" | "created_at"
> & { tickers?: string[] };

type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_end_date: string | null;
};

async function attachTickers<T extends { id: string }>(rows: T[]): Promise<(T & { tickers: string[] })[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tickerRows = await mysqlQuery<{ post_id: string; symbol: string }[]>(
    `select post_id, symbol from post_tickers where post_id in (${placeholders}) order by symbol`,
    ids,
  );
  const map = new Map<string, string[]>();
  for (const r of tickerRows) {
    const arr = map.get(r.post_id) ?? [];
    arr.push(r.symbol);
    map.set(r.post_id, arr);
  }
  return rows.map((r) => ({ ...r, tickers: map.get(r.id) ?? [] }));
}

export async function listPosts(opts: { kind?: PostKind; limit?: number; symbol?: string } = {}) {
  const { kind, limit, symbol } = opts;
  const params: unknown[] = [];
  let sql =
    "select p.id, p.title, p.slug, p.kind, p.excerpt, p.is_premium, p.created_at from posts p";
  const wheres: string[] = ["p.is_published = 1"];

  if (symbol) {
    sql += " inner join post_tickers pt on pt.post_id = p.id";
    wheres.push("pt.symbol = ?");
    params.push(symbol);
  }
  if (kind) {
    wheres.push("p.kind = ?");
    params.push(kind);
  }
  sql += ` where ${wheres.join(" and ")} order by p.created_at desc`;
  if (limit) {
    sql += " limit ?";
    params.push(limit);
  }

  const rows = await mysqlQuery<PostListItem[]>(sql, params);
  return attachTickers(rows);
}

export async function getPostBySlug(slug: string): Promise<PostRow | null> {
  const rows = await mysqlQuery<PostRow[]>(
    `select id, title, slug, kind, excerpt, content, is_premium, is_published, created_at, author_id
     from posts where slug = ? and is_published = 1 limit 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function getCurrentUserSubscriptionStatus() {
  const user = await getSessionUser();
  if (!user) return { user: null, subscribed: false };

  const rows = await mysqlQuery<SubscriptionProfile[]>(
    "select subscription_status, subscription_end_date from users where id = ? limit 1",
    [user.id],
  );
  const profile = rows[0];
  const isActive = profile?.subscription_status === "active";
  const hasNotExpired =
    !profile?.subscription_end_date || new Date(profile.subscription_end_date) > new Date();
  return { user, subscribed: isActive && hasNotExpired };
}
