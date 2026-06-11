import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";
import { hasResearchAccess } from "@/lib/entitlements";
import { reconcileExpiredSubscription } from "@/lib/subscription";

export type PostKind = "analysis" | "news";

export type PostRow = {
  id: string;
  title: string;
  title_en: string | null;
  slug: string;
  kind: PostKind;
  excerpt: string;
  excerpt_en: string | null;
  content: string;
  content_en: string | null;
  is_premium: number;
  is_published: number;
  created_at: string;
  author_id: string | null;
};

export type PostListItem = Pick<
  PostRow,
  "id" | "title" | "title_en" | "slug" | "kind" | "excerpt" | "excerpt_en" | "is_premium" | "created_at"
> & { tickers?: string[] };

type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_end_date: string | null;
  entitlement_research: number | null;
  entitlement_options: number | null;
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

export type PostPeriod = "week" | "month";

export async function listPosts(
  opts: {
    kind?: PostKind;
    limit?: number;
    symbol?: string;
    symbols?: string[];
    sector?: string;
    period?: PostPeriod;
  } = {},
) {
  const { kind, limit, symbol, symbols, sector, period } = opts;
  const params: unknown[] = [];
  let sql =
    "select distinct p.id, p.title, p.title_en, p.slug, p.kind, p.excerpt, p.excerpt_en, p.is_premium, p.created_at from posts p";
  const wheres: string[] = ["p.is_published = 1"];
  const joins: string[] = [];

  const symbolFilter = symbols?.length ? symbols : symbol ? [symbol] : [];

  if (symbolFilter.length || sector) {
    joins.push("inner join post_tickers pt on pt.post_id = p.id");
    if (sector) joins.push("inner join tickers tk on tk.symbol = pt.symbol");
  }
  if (symbolFilter.length === 1) {
    wheres.push("pt.symbol = ?");
    params.push(symbolFilter[0]);
  } else if (symbolFilter.length > 1) {
    wheres.push(`pt.symbol in (${symbolFilter.map(() => "?").join(",")})`);
    params.push(...symbolFilter);
  }
  if (sector) {
    wheres.push("tk.sector = ?");
    params.push(sector);
  }
  if (period === "week") {
    wheres.push("p.created_at >= date_sub(now(), interval 7 day)");
  } else if (period === "month") {
    wheres.push("p.created_at >= date_sub(now(), interval 30 day)");
  }
  if (kind) {
    wheres.push("p.kind = ?");
    params.push(kind);
  }
  if (joins.length) sql += ` ${joins.join(" ")}`;
  sql += ` where ${wheres.join(" and ")} order by p.created_at desc`;
  if (limit) {
    sql += " limit ?";
    params.push(limit);
  }

  const rows = await mysqlQuery<PostListItem[]>(sql, params);
  return attachTickers(rows);
}

export async function listPublishedSlugsForSitemap() {
  return mysqlQuery<{ slug: string; kind: PostKind; created_at: string }[]>(
    `select slug, kind, created_at from posts where is_published = 1 order by created_at desc limit 500`,
  );
}

export async function listPostSectors(): Promise<string[]> {
  const rows = await mysqlQuery<{ sector: string }[]>(
    `select distinct tk.sector as sector
       from post_tickers pt
       inner join tickers tk on tk.symbol = pt.symbol
       inner join posts p on p.id = pt.post_id
      where p.is_published = 1 and tk.sector is not null and tk.sector != ''
      order by tk.sector`,
  );
  return rows.map((r) => r.sector);
}

export async function getPostBySlug(slug: string): Promise<PostRow | null> {
  const rows = await mysqlQuery<PostRow[]>(
    `select id, title, title_en, slug, kind, excerpt, excerpt_en, content, content_en, is_premium, is_published, created_at, author_id
     from posts where slug = ? and is_published = 1 limit 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export type AdminPostRow = PostRow & { tickers: string[] };

export async function listAllPostsAdmin(opts: {
  kind?: PostKind;
  published?: "all" | "published" | "draft";
  limit?: number;
} = {}) {
  const { kind, published = "all", limit = 200 } = opts;
  const params: unknown[] = [];
  const wheres: string[] = ["1=1"];
  if (kind) {
    wheres.push("p.kind = ?");
    params.push(kind);
  }
  if (published === "published") wheres.push("p.is_published = 1");
  if (published === "draft") wheres.push("p.is_published = 0");

  const rows = await mysqlQuery<PostRow[]>(
    `select p.id, p.title, p.title_en, p.slug, p.kind, p.excerpt, p.excerpt_en, p.content, p.content_en, p.is_premium, p.is_published, p.created_at, p.author_id
       from posts p
      where ${wheres.join(" and ")}
      order by p.created_at desc
      limit ?`,
    [...params, limit],
  );
  return attachTickers(rows);
}

export async function getPostByIdAdmin(id: string): Promise<AdminPostRow | null> {
  const rows = await mysqlQuery<PostRow[]>(
    `select id, title, title_en, slug, kind, excerpt, excerpt_en, content, content_en, is_premium, is_published, created_at, author_id
       from posts where id = ? limit 1`,
    [id],
  );
  const post = rows[0];
  if (!post) return null;
  const withTickers = await attachTickers([post]);
  return withTickers[0] ?? null;
}

export async function bulkSetPublished(ids: string[], published: boolean) {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  await mysqlQuery(
    `update posts set is_published = ? where id in (${placeholders})`,
    [published ? 1 : 0, ...ids],
  );
}

export async function getCurrentUserSubscriptionStatus() {
  const user = await getSessionUser();
  if (!user) return { user: null, subscribed: false };

  await reconcileExpiredSubscription(user.id);
  const rows = await mysqlQuery<SubscriptionProfile[]>(
    `select subscription_status, subscription_end_date,
            entitlement_research, entitlement_options
       from users where id = ? limit 1`,
    [user.id],
  );
  const profile = rows[0];
  const subscribed = hasResearchAccess(
    user
      ? {
          subscriptionStatus: profile?.subscription_status,
          subscriptionEndDate: profile?.subscription_end_date,
          entitlementResearch: Number(profile?.entitlement_research ?? 0) === 1,
          entitlementOptions: Number(profile?.entitlement_options ?? 0) === 1,
        }
      : null,
  );
  return { user, subscribed };
}
