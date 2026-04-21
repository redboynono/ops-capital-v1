import { mysqlQuery } from "@/lib/mysql";

export type BookmarkRow = {
  post_id: string;
  title: string;
  slug: string;
  kind: "analysis" | "news";
  excerpt: string;
  is_premium: number;
  created_at: string;
  bookmarked_at: string;
};

export type HistoryRow = {
  post_id: string;
  title: string;
  slug: string;
  kind: "analysis" | "news";
  is_premium: number;
  read_at: string;
};

export async function listBookmarks(userId: string, limit = 50) {
  return mysqlQuery<BookmarkRow[]>(
    `select p.id as post_id, p.title, p.slug, p.kind, p.excerpt, p.is_premium, p.created_at, b.created_at as bookmarked_at
     from bookmarks b
     inner join posts p on p.id = b.post_id
     where b.user_id = ? and p.is_published = 1
     order by b.created_at desc
     limit ?`,
    [userId, limit],
  );
}

export async function listHistory(userId: string, limit = 50) {
  return mysqlQuery<HistoryRow[]>(
    `select p.id as post_id, p.title, p.slug, p.kind, p.is_premium, h.read_at
     from reading_history h
     inner join posts p on p.id = h.post_id
     where h.user_id = ? and p.is_published = 1
     order by h.read_at desc
     limit ?`,
    [userId, limit],
  );
}

export async function addBookmark(userId: string, postId: string) {
  await mysqlQuery(
    "insert ignore into bookmarks (user_id, post_id) values (?, ?)",
    [userId, postId],
  );
}

export async function removeBookmark(userId: string, postId: string) {
  await mysqlQuery("delete from bookmarks where user_id = ? and post_id = ?", [userId, postId]);
}

export async function isBookmarked(userId: string, postId: string) {
  const rows = await mysqlQuery<{ user_id: string }[]>(
    "select user_id from bookmarks where user_id = ? and post_id = ? limit 1",
    [userId, postId],
  );
  return rows.length > 0;
}

export async function recordRead(userId: string, postId: string) {
  await mysqlQuery(
    "insert into reading_history (user_id, post_id) values (?, ?) on duplicate key update read_at = current_timestamp",
    [userId, postId],
  );
}

export async function getMemberStats(userId: string) {
  const [bookmarkRows, historyRows, weeklyRows] = await Promise.all([
    mysqlQuery<{ total: number }[]>("select count(*) as total from bookmarks where user_id = ?", [userId]),
    mysqlQuery<{ total: number }[]>("select count(*) as total from reading_history where user_id = ?", [userId]),
    mysqlQuery<{ total: number }[]>(
      "select count(*) as total from posts where is_published = 1 and created_at >= date_sub(utc_timestamp(), interval 7 day)",
      [],
    ),
  ]);

  return {
    bookmarks: Number(bookmarkRows[0]?.total ?? 0),
    readCount: Number(historyRows[0]?.total ?? 0),
    newThisWeek: Number(weeklyRows[0]?.total ?? 0),
  };
}
