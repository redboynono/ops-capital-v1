import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";

export type BriefingRow = {
  id: string;
  user_id: string;
  brief_date: string;
  content_markdown: string;
  ticker_count: number;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

/** 上 N 天的简报（最新在前），给 /dashboard/briefing 用。 */
export async function listBriefingsForUser(userId: string, limit = 30): Promise<BriefingRow[]> {
  return mysqlQuery<BriefingRow[]>(
    `select id, user_id, cast(brief_date as char) as brief_date,
            content_markdown, ticker_count, email_sent_at,
            created_at, updated_at
       from daily_briefings
      where user_id = ?
      order by brief_date desc
      limit ?`,
    [userId, limit],
  );
}

export async function getBriefingByDate(userId: string, dateISO: string): Promise<BriefingRow | null> {
  const rows = await mysqlQuery<BriefingRow[]>(
    `select id, user_id, cast(brief_date as char) as brief_date,
            content_markdown, ticker_count, email_sent_at,
            created_at, updated_at
       from daily_briefings
      where user_id = ? and brief_date = ?
      limit 1`,
    [userId, dateISO],
  );
  return rows[0] ?? null;
}

/** upsert 简报。同 (user_id, brief_date) 已存在则覆盖 content。 */
export async function upsertBriefing(input: {
  userId: string;
  date: string;
  content: string;
  tickerCount: number;
}): Promise<string> {
  const id = randomUUID();
  await mysqlQuery(
    `insert into daily_briefings (id, user_id, brief_date, content_markdown, ticker_count)
     values (?, ?, ?, ?, ?)
     on duplicate key update
       content_markdown = values(content_markdown),
       ticker_count = values(ticker_count),
       email_sent_at = null`,
    [id, input.userId, input.date, input.content, input.tickerCount],
  );
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from daily_briefings where user_id = ? and brief_date = ? limit 1",
    [input.userId, input.date],
  );
  return rows[0]?.id ?? id;
}

export async function markBriefingEmailSent(briefingId: string): Promise<void> {
  await mysqlQuery("update daily_briefings set email_sent_at = current_timestamp where id = ?", [
    briefingId,
  ]);
}

/** 查"该用户今天有没有简报需要发邮件"。给 cron / on-demand 用。 */
export async function listUsersWithBriefingPrefs(): Promise<
  {
    id: string;
    email: string;
    email_briefing_enabled: number;
  }[]
> {
  return mysqlQuery<
    { id: string; email: string; email_briefing_enabled: number }[]
  >(
    `select u.id, u.email, u.email_briefing_enabled
       from users u
      where exists (select 1 from watchlist w where w.user_id = u.id)`,
  );
}
