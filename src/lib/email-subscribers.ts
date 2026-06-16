/**
 * 邮箱留资（免费每日简报订阅）。
 * 幂等 upsert：同一邮箱重复订阅只刷新来源/状态，不报错。
 */
import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";

export type SubscribeInput = {
  email: string;
  locale?: string;
  source?: string;
  utmSource?: string;
  userId?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 255;
}

export type SubscribeResult = { ok: true; created: boolean } | { ok: false; error: string };

export async function subscribeEmail(input: SubscribeInput): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "invalid email" };

  const locale = input.locale === "en" ? "en" : "zh";
  const source = (input.source ?? "").slice(0, 48) || null;
  const utmSource = (input.utmSource ?? "").slice(0, 48) || null;
  const token = randomUUID().replace(/-/g, "");

  // 幂等：已存在则复活为 active 并刷新来源；不存在则插入
  const result = await mysqlQuery<{ affectedRows: number; insertId: number }>(
    `insert into email_subscribers (email, locale, source, utm_source, user_id, status, unsubscribe_token)
     values (?, ?, ?, ?, ?, 'active', ?)
     on duplicate key update
       status = 'active',
       locale = values(locale),
       source = coalesce(email_subscribers.source, values(source)),
       utm_source = coalesce(email_subscribers.utm_source, values(utm_source)),
       user_id = coalesce(values(user_id), email_subscribers.user_id),
       updated_at = current_timestamp`,
    [email, locale, source, utmSource, input.userId ?? null, token],
  );
  // affectedRows: 1 = 新插入；2 = 更新已有
  const created = (result as unknown as { affectedRows?: number })?.affectedRows === 1;
  return { ok: true, created };
}

export type SubscriberRow = {
  id: number;
  email: string;
  locale: string;
  unsubscribe_token: string;
};

export async function listActiveSubscribers(locale?: "zh" | "en"): Promise<SubscriberRow[]> {
  if (locale) {
    return mysqlQuery<SubscriberRow[]>(
      `select id, email, locale, unsubscribe_token
         from email_subscribers
        where status = 'active' and locale = ?`,
      [locale],
    );
  }
  return mysqlQuery<SubscriberRow[]>(
    `select id, email, locale, unsubscribe_token
       from email_subscribers
      where status = 'active'`,
  );
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!token || token.length > 40) return false;
  const r = await mysqlQuery<{ affectedRows: number }>(
    `update email_subscribers set status = 'unsubscribed' where unsubscribe_token = ?`,
    [token],
  );
  return (r as unknown as { affectedRows?: number })?.affectedRows ? true : false;
}

export async function countActiveSubscribers(): Promise<number> {
  const [r] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from email_subscribers where status = 'active'`,
  );
  return Number(r?.n ?? 0);
}
