import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";

export type SocialContentType = "analysis" | "news" | "rating_change" | "value_chain" | "custom";
export type SocialOpsStatus = "draft" | "posted_x" | "posted_xhs" | "done";

export type SocialOpsRecord = {
  id: string;
  content_type: SocialContentType;
  ref_key: string | null;
  title: string;
  canonical_url: string;
  x_copy: string;
  xhs_copy: string;
  utm_campaign: string | null;
  status: SocialOpsStatus;
  notes: string | null;
  posted_x_at: string | null;
  posted_xhs_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSocialOpsRecords(opts: { limit?: number; status?: SocialOpsStatus } = {}) {
  const params: unknown[] = [];
  let sql = `select id, content_type, ref_key, title, canonical_url, x_copy, xhs_copy,
                    utm_campaign, status, notes,
                    cast(posted_x_at as char) as posted_x_at,
                    cast(posted_xhs_at as char) as posted_xhs_at,
                    created_by,
                    cast(created_at as char) as created_at,
                    cast(updated_at as char) as updated_at
               from social_ops_posts`;
  if (opts.status) {
    sql += " where status = ?";
    params.push(opts.status);
  }
  sql += " order by updated_at desc";
  if (opts.limit) {
    sql += " limit ?";
    params.push(opts.limit);
  }
  return mysqlQuery<SocialOpsRecord[]>(sql, params);
}

export async function createSocialOpsRecord(input: {
  contentType: SocialContentType;
  refKey?: string | null;
  title: string;
  canonicalUrl: string;
  xCopy: string;
  xhsCopy: string;
  utmCampaign?: string | null;
  createdBy?: string | null;
}): Promise<SocialOpsRecord> {
  const id = randomUUID();
  await mysqlQuery(
    `insert into social_ops_posts
       (id, content_type, ref_key, title, canonical_url, x_copy, xhs_copy, utm_campaign, created_by)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.contentType,
      input.refKey ?? null,
      input.title,
      input.canonicalUrl,
      input.xCopy,
      input.xhsCopy,
      input.utmCampaign ?? null,
      input.createdBy ?? null,
    ],
  );
  const rows = await mysqlQuery<SocialOpsRecord[]>(
    `select id, content_type, ref_key, title, canonical_url, x_copy, xhs_copy,
            utm_campaign, status, notes,
            cast(posted_x_at as char) as posted_x_at,
            cast(posted_xhs_at as char) as posted_xhs_at,
            created_by,
            cast(created_at as char) as created_at,
            cast(updated_at as char) as updated_at
       from social_ops_posts where id = ? limit 1`,
    [id],
  );
  return rows[0]!;
}

export async function updateSocialOpsRecord(
  id: string,
  patch: Partial<{
    title: string;
    xCopy: string;
    xhsCopy: string;
    notes: string | null;
    status: SocialOpsStatus;
    markPostedX: boolean;
    markPostedXhs: boolean;
  }>,
): Promise<SocialOpsRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.title != null) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.xCopy != null) {
    sets.push("x_copy = ?");
    params.push(patch.xCopy);
  }
  if (patch.xhsCopy != null) {
    sets.push("xhs_copy = ?");
    params.push(patch.xhsCopy);
  }
  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    params.push(patch.notes);
  }
  if (patch.status != null) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.markPostedX) {
    sets.push("posted_x_at = coalesce(posted_x_at, now(3))");
    sets.push("status = case when posted_xhs_at is not null or status = 'posted_xhs' then 'done' else 'posted_x' end");
  }
  if (patch.markPostedXhs) {
    sets.push("posted_xhs_at = coalesce(posted_xhs_at, now(3))");
    sets.push("status = case when posted_x_at is not null or status = 'posted_x' then 'done' else 'posted_xhs' end");
  }

  if (sets.length === 0) return getSocialOpsRecord(id);

  params.push(id);
  await mysqlQuery(`update social_ops_posts set ${sets.join(", ")} where id = ?`, params);
  return getSocialOpsRecord(id);
}

export async function getSocialOpsRecord(id: string): Promise<SocialOpsRecord | null> {
  const rows = await mysqlQuery<SocialOpsRecord[]>(
    `select id, content_type, ref_key, title, canonical_url, x_copy, xhs_copy,
            utm_campaign, status, notes,
            cast(posted_x_at as char) as posted_x_at,
            cast(posted_xhs_at as char) as posted_xhs_at,
            created_by,
            cast(created_at as char) as created_at,
            cast(updated_at as char) as updated_at
       from social_ops_posts where id = ? limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function countAnalysisPostedToday(): Promise<number> {
  const rows = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from social_ops_posts
      where content_type = 'analysis'
        and posted_x_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function isAnalysisPostedToday(refKey: string): Promise<boolean> {
  const rows = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from social_ops_posts
      where content_type = 'analysis' and ref_key = ?
        and posted_x_at >= date_sub(current_timestamp, interval 24 hour)`,
    [refKey],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}
