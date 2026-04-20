import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";

export type ReportPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  is_premium: boolean;
  is_published: boolean;
  created_at: string;
  author_id: string | null;
};

type SubscriptionProfile = {
  subscription_status: string | null;
  subscription_end_date: string | null;
};

export async function getPublishedPosts(limit?: number) {
  const sql = limit
    ? "select id, title, slug, excerpt, is_premium, created_at from posts where is_published = 1 order by created_at desc limit ?"
    : "select id, title, slug, excerpt, is_premium, created_at from posts where is_published = 1 order by created_at desc";

  const params = limit ? [limit] : [];
  return mysqlQuery<Pick<ReportPost, "id" | "title" | "slug" | "excerpt" | "is_premium" | "created_at">[]>(
    sql,
    params,
  );
}

export async function getPostBySlug(slug: string): Promise<ReportPost | null> {
  const rows = await mysqlQuery<ReportPost[]>(
    "select id, title, slug, excerpt, content, is_premium, is_published, created_at, author_id from posts where slug = ? and is_published = 1 limit 1",
    [slug],
  );
  return rows[0] ?? null;
}

export async function getCurrentUserSubscriptionStatus() {
  const user = await getSessionUser();

  if (!user) {
    return { user: null, subscribed: false };
  }

  const rows = await mysqlQuery<SubscriptionProfile[]>(
    "select subscription_status, subscription_end_date from users where id = ? limit 1",
    [user.id],
  );

  const profile = rows[0];

  const isActive = profile?.subscription_status === "active";
  const hasNotExpired = !profile?.subscription_end_date || new Date(profile.subscription_end_date) > new Date();

  return {
    user,
    subscribed: isActive && hasNotExpired,
  };
}
