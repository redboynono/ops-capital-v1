import { randomUUID } from "node:crypto";

import { analyzeXWatchTweet, generateXWatchReply, translateXWatchReplyZh } from "@/lib/ai/xWatchAnalyze";
import { mysqlQuery } from "@/lib/mysql";
import { postTweet, isXPostingEnabled } from "@/lib/social/x-api";
import { fetchUserTimeline, isXReadConfigured, resolveXUserId } from "@/lib/social/x-read";

export const DEFAULT_X_WATCH_USERNAME = "aleabitoreddit";

export type XWatchStatus = "pending" | "posted" | "skipped";

export type XWatchItem = {
  id: string;
  source_username: string;
  tweet_id: string;
  tweet_text: string;
  tweet_url: string;
  posted_at: string;
  topic_type: string | null;
  tickers: string[];
  summary_md: string | null;
  ops_angle_md: string | null;
  reply_draft: string | null;
  reply_draft_zh: string | null;
  status: XWatchStatus;
  posted_reply_tweet_id: string | null;
  posted_reply_at: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = Omit<XWatchItem, "tickers" | "posted_at" | "posted_reply_at" | "analyzed_at" | "created_at" | "updated_at"> & {
  tickers_json: string | string[] | null;
  posted_at: string | Date;
  posted_reply_at: string | Date | null;
  analyzed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(v: string | Date | null | undefined): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rowToItem(r: ItemRow): XWatchItem {
  let tickers: string[] = [];
  if (r.tickers_json) {
    try {
      const parsed =
        typeof r.tickers_json === "string" ? JSON.parse(r.tickers_json) : r.tickers_json;
      tickers = Array.isArray(parsed)
        ? parsed.map((t) => String(t).replace(/^\$/, "").toUpperCase()).filter(Boolean)
        : [];
    } catch {
      tickers = [];
    }
  }
  return {
    id: r.id,
    source_username: r.source_username,
    tweet_id: r.tweet_id,
    tweet_text: r.tweet_text,
    tweet_url: r.tweet_url,
    posted_at: toIso(r.posted_at),
    topic_type: r.topic_type,
    tickers,
    summary_md: r.summary_md,
    ops_angle_md: r.ops_angle_md,
    reply_draft: r.reply_draft,
    reply_draft_zh: r.reply_draft_zh ?? null,
    status: r.status,
    posted_reply_tweet_id: r.posted_reply_tweet_id,
    posted_reply_at: r.posted_reply_at ? toIso(r.posted_reply_at) : null,
    analyzed_at: r.analyzed_at ? toIso(r.analyzed_at) : null,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  };
}

export function watchUsername(): string {
  return (process.env.X_WATCH_USERNAME ?? DEFAULT_X_WATCH_USERNAME).replace(/^@/, "");
}

function tweetUrl(username: string, tweetId: string): string {
  return `https://x.com/${username}/status/${tweetId}`;
}

function friendlyAiError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("no json object") || m.includes("no reply_draft") || m.includes("未返回有效 json")) {
    return "AI 未返回有效 JSON，请重试（Gemini 思考模型偶发截断）";
  }
  if (m.includes("empty model output") || m.includes("empty reply")) {
    return "AI 未返回有效草稿，请重试";
  }
  if (m.includes("timeout") || m.includes("abort")) {
    return "AI 请求超时，请重试";
  }
  return message;
}

function friendlyPostError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not been mentioned") || m.includes("not allowed because you have not")) {
    return "X 平台限制：对方未 @ 你或未与你互动，无法在其帖下直接回复。请用「复制英文草稿」后手动 Quote 或发推 @ 对方。";
  }
  if (m.includes("oauth2 not authorized") || m.includes("credentials missing")) {
    return "X 发帖未授权：请访问 /api/admin/x-oauth/start 重新授权。";
  }
  if (m.includes("duplicate") || m.includes("already posted")) {
    return "该内容可能已发过，请检查 X 时间线。";
  }
  return message;
}

export async function translateReplyForXWatchItemById(id: string): Promise<{ ok: boolean; error?: string }> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  const en = item.reply_draft?.trim();
  if (!en) return { ok: false, error: "英文草稿为空" };

  try {
    const reply_draft_zh = await translateXWatchReplyZh(en);
    await mysqlQuery(
      `update x_watch_items set reply_draft_zh = ?, updated_at = current_timestamp(3) where id = ?`,
      [reply_draft_zh, id],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyAiError(e instanceof Error ? e.message : "translate failed") };
  }
}

async function getState(username: string) {
  const [row] = await mysqlQuery<
    {
      source_username: string;
      x_user_id: string | null;
      last_tweet_id: string | null;
      last_polled_at: string | Date | null;
    }[]
  >(`select source_username, x_user_id, last_tweet_id, last_polled_at from x_watch_state where source_username = ?`, [
    username,
  ]);
  return row ?? null;
}

async function upsertState(username: string, patch: { x_user_id?: string; last_tweet_id?: string }) {
  await mysqlQuery(
    `insert into x_watch_state (source_username, x_user_id, last_tweet_id, last_polled_at)
     values (?, ?, ?, current_timestamp(3))
     on duplicate key update
       x_user_id = coalesce(values(x_user_id), x_user_id),
       last_tweet_id = coalesce(values(last_tweet_id), last_tweet_id),
       last_polled_at = current_timestamp(3)`,
    [username, patch.x_user_id ?? null, patch.last_tweet_id ?? null],
  );
}

export async function listXWatchItems(limit = 40, status?: XWatchStatus): Promise<XWatchItem[]> {
  const rows = status
    ? await mysqlQuery<ItemRow[]>(
        `select * from x_watch_items where status = ? order by posted_at desc limit ?`,
        [status, limit],
      )
    : await mysqlQuery<ItemRow[]>(`select * from x_watch_items order by posted_at desc limit ?`, [limit]);
  return rows.map(rowToItem);
}

export async function getXWatchItem(id: string): Promise<XWatchItem | null> {
  const [row] = await mysqlQuery<ItemRow[]>(`select * from x_watch_items where id = ?`, [id]);
  return row ? rowToItem(row) : null;
}

export async function pollXWatch(opts?: {
  username?: string;
  analyze?: boolean;
  maxFetch?: number;
}): Promise<{
  ok: boolean;
  username: string;
  fetched: number;
  inserted: number;
  analyzed: number;
  error?: string;
}> {
  const username = (opts?.username ?? watchUsername()).replace(/^@/, "");
  if (!isXReadConfigured()) {
    return { ok: false, username, fetched: 0, inserted: 0, analyzed: 0, error: "X read API not configured" };
  }

  const state = await getState(username);
  let userId = state?.x_user_id ?? null;
  if (!userId) {
    const user = await resolveXUserId(username);
    userId = user.id;
    await upsertState(username, { x_user_id: userId });
  }

  const tweets = await fetchUserTimeline(userId, {
    maxResults: opts?.maxFetch ?? 15,
    sinceId: state?.last_tweet_id ?? undefined,
  });

  let inserted = 0;
  let analyzed = 0;
  const sorted = [...tweets].sort((a, b) => {
    const da = BigInt(a.id);
    const db = BigInt(b.id);
    return da < db ? -1 : da > db ? 1 : 0;
  });

  for (const t of sorted) {
    const [exists] = await mysqlQuery<{ id: string }[]>(
      `select id from x_watch_items where tweet_id = ? limit 1`,
      [t.id],
    );
    if (exists) continue;

    const id = randomUUID();
    await mysqlQuery(
      `insert into x_watch_items
        (id, source_username, tweet_id, tweet_text, tweet_url, posted_at, status)
       values (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, username, t.id, t.text, tweetUrl(username, t.id), t.createdAt.replace("T", " ").slice(0, 23)],
    );
    inserted++;

    if (opts?.analyze !== false) {
      const ok = await analyzeXWatchItemById(id);
      if (ok.ok) analyzed++;
    }
  }

  if (sorted.length > 0) {
    const newest = sorted[sorted.length - 1]!.id;
    await upsertState(username, { x_user_id: userId, last_tweet_id: newest });
  } else {
    await upsertState(username, { x_user_id: userId });
  }

  return { ok: true, username, fetched: tweets.length, inserted, analyzed };
}

export async function analyzeXWatchItemById(id: string): Promise<{ ok: boolean; error?: string }> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };

  try {
    const a = await analyzeXWatchTweet({
      username: item.source_username,
      tweetText: item.tweet_text,
      tweetUrl: item.tweet_url,
      postedAt: item.posted_at,
    });
    let reply_draft_zh = "";
    if (a.reply_draft) {
      try {
        reply_draft_zh = await translateXWatchReplyZh(a.reply_draft);
      } catch {
        reply_draft_zh = "";
      }
    }
    await mysqlQuery(
      `update x_watch_items set
        topic_type = ?, tickers_json = ?, summary_md = ?, ops_angle_md = ?, reply_draft = ?, reply_draft_zh = ?,
        analyzed_at = current_timestamp(3), updated_at = current_timestamp(3)
       where id = ?`,
      [
        a.topic_type,
        JSON.stringify(a.tickers),
        a.summary_md,
        a.ops_angle_md,
        a.reply_draft,
        reply_draft_zh || null,
        id,
      ],
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "analyze failed" };
  }
}

export async function generateReplyForXWatchItemById(id: string): Promise<{ ok: boolean; error?: string }> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };

  try {
    const { reply_draft, reply_draft_zh } = await generateXWatchReply({
      username: item.source_username,
      tweetText: item.tweet_text,
      tweetUrl: item.tweet_url,
      topicType: item.topic_type,
      summaryMd: item.summary_md,
      opsAngleMd: item.ops_angle_md,
      currentDraft: item.reply_draft,
    });
    await mysqlQuery(
      `update x_watch_items set reply_draft = ?, reply_draft_zh = ?, updated_at = current_timestamp(3) where id = ?`,
      [reply_draft, reply_draft_zh, id],
    );
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "generate reply failed";
    return { ok: false, error: friendlyAiError(raw) };
  }
}

export async function updateXWatchDraft(
  id: string,
  patch: { reply_draft?: string; reply_draft_zh?: string; summary_md?: string; ops_angle_md?: string },
): Promise<{ ok: boolean; error?: string }> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };

  await mysqlQuery(
    `update x_watch_items set
      reply_draft = coalesce(?, reply_draft),
      reply_draft_zh = coalesce(?, reply_draft_zh),
      summary_md = coalesce(?, summary_md),
      ops_angle_md = coalesce(?, ops_angle_md),
      updated_at = current_timestamp(3)
     where id = ?`,
    [
      patch.reply_draft ?? null,
      patch.reply_draft_zh ?? null,
      patch.summary_md ?? null,
      patch.ops_angle_md ?? null,
      id,
    ],
  );
  return { ok: true };
}

export async function skipXWatchItem(id: string): Promise<{ ok: boolean; error?: string }> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };
  await mysqlQuery(
    `update x_watch_items set status = 'skipped', updated_at = current_timestamp(3) where id = ?`,
    [id],
  );
  return { ok: true };
}

export async function postXWatchReply(id: string): Promise<{
  ok: boolean;
  replyTweetId?: string;
  error?: string;
}> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };
  const text = item.reply_draft?.trim();
  if (!text) return { ok: false, error: "reply draft empty" };
  if (text.length > 280) return { ok: false, error: "reply exceeds 280 characters" };

  try {
    const { tweetId } = await postTweet(text, item.tweet_id);
    await mysqlQuery(
      `update x_watch_items set
        status = 'posted', posted_reply_tweet_id = ?, posted_reply_at = current_timestamp(3),
        updated_at = current_timestamp(3)
       where id = ?`,
      [tweetId, id],
    );
    return { ok: true, replyTweetId: tweetId };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "post failed";
    return { ok: false, error: friendlyPostError(raw) };
  }
}

export async function getXWatchMeta(): Promise<{
  username: string;
  readConfigured: boolean;
  postConfigured: boolean;
  lastPolledAt: string | null;
  pendingCount: number;
}> {
  const username = watchUsername();
  const state = await getState(username);
  const [cnt] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from x_watch_items where status = 'pending'`,
  );
  return {
    username,
    readConfigured: isXReadConfigured(),
    postConfigured: isXPostingEnabled(),
    lastPolledAt: state?.last_polled_at ? toIso(state.last_polled_at) : null,
    pendingCount: Number(cnt?.n ?? 0),
  };
}
