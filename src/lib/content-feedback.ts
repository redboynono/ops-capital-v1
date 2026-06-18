/**
 * 内容有用度反馈 — 👍/👎 on analysis posts & picks
 */
import { randomUUID } from "node:crypto";

import { mysqlQuery } from "@/lib/mysql";

export type ContentRefType = "post" | "pick";

export type FeedbackSummary = {
  total: number;
  yesCount: number;
  /** 对外展示百分比；样本不足时为 null */
  helpfulPct: number | null;
  /** 当前访问者已投的票；未投为 null */
  userVote: boolean | null;
};

/** 对外展示「有用率」所需最少样本 */
export const FEEDBACK_PUBLIC_MIN = 10;

export async function getFeedbackSummary(
  refType: ContentRefType,
  refKey: string,
  actorKey?: string | null,
): Promise<FeedbackSummary> {
  const [agg] = await mysqlQuery<{ total: number; yes_count: number }[]>(
    `select count(*) as total,
            coalesce(sum(case when helpful = 1 then 1 else 0 end), 0) as yes_count
       from content_feedback
      where ref_type = ? and ref_key = ?`,
    [refType, refKey],
  );

  const total = Number(agg?.total ?? 0);
  const yesCount = Number(agg?.yes_count ?? 0);

  let userVote: boolean | null = null;
  if (actorKey) {
    const [row] = await mysqlQuery<{ helpful: number }[]>(
      `select helpful from content_feedback
        where ref_type = ? and ref_key = ? and actor_key = ? limit 1`,
      [refType, refKey, actorKey],
    );
    if (row) userVote = row.helpful === 1;
  }

  return {
    total,
    yesCount,
    helpfulPct:
      total >= FEEDBACK_PUBLIC_MIN ? Math.round((yesCount / total) * 100) : null,
    userVote,
  };
}

export async function submitContentFeedback(input: {
  refType: ContentRefType;
  refKey: string;
  helpful: boolean;
  userId?: string | null;
  visitorId?: string | null;
}): Promise<{ ok: true; summary: FeedbackSummary } | { ok: false; error: string }> {
  const refKey = input.refKey.trim().slice(0, 255);
  if (!refKey) return { ok: false, error: "ref_key required" };

  let actorKey: string;
  let actorKind: "user" | "visitor";
  if (input.userId) {
    actorKey = input.userId;
    actorKind = "user";
  } else if (input.visitorId) {
    actorKey = input.visitorId.slice(0, 64);
    actorKind = "visitor";
  } else {
    return { ok: false, error: "visitor_id required" };
  }

  const helpful = input.helpful ? 1 : 0;
  const id = randomUUID();

  await mysqlQuery(
    `insert into content_feedback (id, ref_type, ref_key, helpful, actor_key, actor_kind)
     values (?, ?, ?, ?, ?, ?)
     on duplicate key update helpful = values(helpful), updated_at = current_timestamp(3)`,
    [id, input.refType, refKey, helpful, actorKey, actorKind],
  );

  const summary = await getFeedbackSummary(input.refType, refKey, actorKey);
  return { ok: true, summary };
}

export type ContentHelpfulRow = {
  ref_type: ContentRefType;
  ref_key: string;
  title: string;
  total: number;
  helpful_pct: number;
};

/** admin/growth：有用率排行（样本 ≥ minVotes） */
export async function getContentHelpfulLeaderboard(
  minVotes = 5,
  limit = 20,
): Promise<ContentHelpfulRow[]> {
  const rows = await mysqlQuery<
    Array<{
      ref_type: ContentRefType;
      ref_key: string;
      title: string | null;
      total: string | number;
      helpful_pct: string | number;
    }>
  >(
    `select cf.ref_type,
            cf.ref_key,
            coalesce(p.title, pk.ticker, cf.ref_key) as title,
            count(*) as total,
            round(100 * sum(cf.helpful = 1) / count(*), 1) as helpful_pct
       from content_feedback cf
       left join posts p on cf.ref_type = 'post' and p.slug = cf.ref_key
       left join ops_picks pk on cf.ref_type = 'pick' and pk.slug = cf.ref_key
      group by cf.ref_type, cf.ref_key, title
     having count(*) >= ?
      order by helpful_pct desc, total desc
      limit ?`,
    [minVotes, limit],
  );

  return rows.map((r) => ({
    ref_type: r.ref_type,
    ref_key: r.ref_key,
    title: r.title ?? r.ref_key,
    total: Number(r.total),
    helpful_pct: Number(r.helpful_pct),
  }));
}
