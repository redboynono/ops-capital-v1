import { randomUUID } from "node:crypto";

import { analyzeXWatchTweet, generateXWatchReply, translateXWatchReplyZh } from "@/lib/ai/xWatchAnalyze";
import { mysqlQuery } from "@/lib/mysql";
import { postTweet, isXPostingEnabled } from "@/lib/social/x-api";
import { fetchTweetMetrics, fetchUserTimeline, isXReadConfigured, resolveXUserId } from "@/lib/social/x-read";
import {
  resolveWatchInfluencers,
  watchPollBatchSize,
  type XWatchInfluencerCategory,
} from "@/lib/x-watch-influencers";

export const DEFAULT_X_WATCH_USERNAME = "aleabitoreddit";

export type XWatchStatus = "pending" | "posted" | "skipped";

export type XWatchPostMode = "reply" | "quote" | "mention";

export const X_WATCH_AUTO_REPLY_TOPICS = new Set([
  "framework",
  "watchlist",
  "conviction",
  "rotation",
  "cheatsheet",
]);

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
  reply_quality_score: number | null;
  status: XWatchStatus;
  posted_reply_tweet_id: string | null;
  posted_reply_at: string | null;
  post_mode: XWatchPostMode | null;
  last_post_error: string | null;
  auto_post_skip_reason: string | null;
  reply_impressions: number | null;
  reply_likes: number | null;
  reply_retweets: number | null;
  metrics_synced_at: string | null;
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
    reply_quality_score: r.reply_quality_score != null ? Number(r.reply_quality_score) : null,
    status: r.status,
    posted_reply_tweet_id: r.posted_reply_tweet_id,
    posted_reply_at: r.posted_reply_at ? toIso(r.posted_reply_at) : null,
    post_mode: (r.post_mode as XWatchPostMode | null) ?? null,
    last_post_error: r.last_post_error ?? null,
    auto_post_skip_reason: r.auto_post_skip_reason ?? null,
    reply_impressions: r.reply_impressions != null ? Number(r.reply_impressions) : null,
    reply_likes: r.reply_likes != null ? Number(r.reply_likes) : null,
    reply_retweets: r.reply_retweets != null ? Number(r.reply_retweets) : null,
    metrics_synced_at: r.metrics_synced_at ? toIso(r.metrics_synced_at) : null,
    analyzed_at: r.analyzed_at ? toIso(r.analyzed_at) : null,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  };
}

export function watchUsername(): string {
  return watchUsernames()[0] ?? DEFAULT_X_WATCH_USERNAME.replace(/^@/, "");
}

export function watchUsernames(): string[] {
  const env = process.env.X_WATCH_USERNAMES?.trim();
  if (env) {
    return [
      ...new Set(
        env
          .split(/[,;\s]+/)
          .map((u) => u.replace(/^@/, "").trim())
          .filter(Boolean),
      ),
    ];
  }
  return resolveWatchInfluencers().handles;
}

const POLL_CURSOR_KEY = "__poll_cursor__";

async function getPollCursor(): Promise<number> {
  const [row] = await mysqlQuery<{ last_tweet_id: string | null }[]>(
    `select last_tweet_id from x_watch_state where source_username = ?`,
    [POLL_CURSOR_KEY],
  );
  return Math.max(0, Number(row?.last_tweet_id ?? 0) || 0);
}

async function setPollCursor(idx: number): Promise<void> {
  await mysqlQuery(
    `insert into x_watch_state (source_username, last_tweet_id, last_polled_at)
     values (?, ?, current_timestamp(3))
     on duplicate key update last_tweet_id = values(last_tweet_id), last_polled_at = current_timestamp(3)`,
    [POLL_CURSOR_KEY, String(idx)],
  );
}

export function getWatchInfluencerMeta(): {
  mode: "env" | "registry";
  categories: XWatchInfluencerCategory[];
  topN: number;
  totalAccounts: number;
  pollBatchSize: number;
  byCategory: Partial<Record<XWatchInfluencerCategory, string[]>>;
} {
  if (process.env.X_WATCH_USERNAMES?.trim()) {
    const handles = watchUsernames();
    return {
      mode: "env",
      categories: [],
      topN: handles.length,
      totalAccounts: handles.length,
      pollBatchSize: watchPollBatchSize(),
      byCategory: {},
    };
  }
  const resolved = resolveWatchInfluencers();
  return {
    mode: "registry",
    categories: resolved.categories,
    topN: resolved.topN,
    totalAccounts: resolved.handles.length,
    pollBatchSize: watchPollBatchSize(),
    byCategory: resolved.byCategory,
  };
}

export function autoReplyMinScore(): number {
  const n = Number(process.env.X_WATCH_AUTO_REPLY_MIN_SCORE ?? 7);
  if (!Number.isFinite(n)) return 7;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function isXWatchAutoReplyEnabled(): boolean {
  return process.env.X_WATCH_AUTO_REPLY === "1";
}

function shouldAutoReplyTopic(topic: string | null): boolean {
  return topic != null && X_WATCH_AUTO_REPLY_TOPICS.has(topic);
}

function withMention(username: string, text: string): string {
  const handle = `@${username.replace(/^@/, "")}`;
  if (text.toLowerCase().includes(handle.toLowerCase())) return text;
  const combined = `${handle} ${text}`;
  return combined.length <= 280 ? combined : text;
}

async function markXWatchPosted(id: string, tweetId: string, postMode: XWatchPostMode) {
  await mysqlQuery(
    `update x_watch_items set
      status = 'posted', posted_reply_tweet_id = ?, posted_reply_at = current_timestamp(3),
      post_mode = ?, last_post_error = null, auto_post_skip_reason = null, updated_at = current_timestamp(3)
     where id = ?`,
    [tweetId, postMode, id],
  );
}

async function markAutoPostSkip(id: string, reason: string) {
  await mysqlQuery(
    `update x_watch_items set auto_post_skip_reason = ?, updated_at = current_timestamp(3) where id = ?`,
    [reason.slice(0, 128), id],
  );
}

async function markXWatchPostFailed(id: string, error: string) {
  await mysqlQuery(
    `update x_watch_items set last_post_error = ?, updated_at = current_timestamp(3) where id = ?`,
    [error.slice(0, 512), id],
  );
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
  autoPosted: number;
  autoSkipped: number;
  autoFailed: number;
  error?: string;
}> {
  const username = (opts?.username ?? watchUsername()).replace(/^@/, "");
  if (!isXReadConfigured()) {
    return {
      ok: false,
      username,
      fetched: 0,
      inserted: 0,
      analyzed: 0,
      autoPosted: 0,
      autoSkipped: 0,
      autoFailed: 0,
      error: "X read API not configured",
    };
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
  let autoPosted = 0;
  let autoSkipped = 0;
  let autoFailed = 0;
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
      if (ok.ok) {
        analyzed++;
        const auto = await tryAutoPostXWatchItem(id);
        if (auto === "posted") autoPosted++;
        else if (auto === "failed") autoFailed++;
        else autoSkipped++;
      }
    }
  }

  if (sorted.length > 0) {
    const newest = sorted[sorted.length - 1]!.id;
    await upsertState(username, { x_user_id: userId, last_tweet_id: newest });
  } else {
    await upsertState(username, { x_user_id: userId });
  }

  return {
    ok: true,
    username,
    fetched: tweets.length,
    inserted,
    analyzed,
    autoPosted,
    autoSkipped,
    autoFailed,
  };
}

export async function pollAllXWatch(opts?: {
  analyze?: boolean;
  maxFetch?: number;
}): Promise<{
  ok: boolean;
  usernames: string[];
  polledUsernames: string[];
  fetched: number;
  inserted: number;
  analyzed: number;
  autoPosted: number;
  autoSkipped: number;
  autoFailed: number;
  metricsSynced: number;
  pollCursor: number;
  totalAccounts: number;
  errors?: string[];
}> {
  const all = watchUsernames();
  const batchSize = watchPollBatchSize();
  const cursor = await getPollCursor();
  const polledUsernames: string[] = [];
  for (let i = 0; i < Math.min(batchSize, all.length); i++) {
    polledUsernames.push(all[(cursor + i) % all.length]!);
  }
  const nextCursor = all.length > 0 ? (cursor + polledUsernames.length) % all.length : 0;
  await setPollCursor(nextCursor);

  const errors: string[] = [];
  let fetched = 0;
  let inserted = 0;
  let analyzed = 0;
  let autoPosted = 0;
  let autoSkipped = 0;
  let autoFailed = 0;
  let ok = true;

  for (const username of polledUsernames) {
    const r = await pollXWatch({ ...opts, username });
    if (!r.ok) {
      ok = false;
      if (r.error) errors.push(`@${username}: ${r.error}`);
      continue;
    }
    fetched += r.fetched;
    inserted += r.inserted;
    analyzed += r.analyzed;
    autoPosted += r.autoPosted;
    autoSkipped += r.autoSkipped;
    autoFailed += r.autoFailed;
  }

  const { synced: metricsSynced } = await syncXWatchReplyMetrics();

  return {
    ok,
    usernames: all,
    polledUsernames,
    fetched,
    inserted,
    analyzed,
    autoPosted,
    autoSkipped,
    autoFailed,
    metricsSynced,
    pollCursor: nextCursor,
    totalAccounts: all.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function syncXWatchReplyMetrics(opts?: { limit?: number }): Promise<{ synced: number }> {
  if (!isXReadConfigured()) return { synced: 0 };
  const rows = await mysqlQuery<{ id: string; posted_reply_tweet_id: string }[]>(
    `select id, posted_reply_tweet_id from x_watch_items
     where status = 'posted' and posted_reply_tweet_id is not null
     order by posted_reply_at desc limit ?`,
    [Math.min(Math.max(opts?.limit ?? 40, 1), 100)],
  );
  if (rows.length === 0) return { synced: 0 };

  const metrics = await fetchTweetMetrics(rows.map((r) => r.posted_reply_tweet_id));
  let synced = 0;
  for (const row of rows) {
    const m = metrics.get(row.posted_reply_tweet_id);
    if (!m) continue;
    await mysqlQuery(
      `update x_watch_items set
        reply_impressions = ?, reply_likes = ?, reply_retweets = ?,
        metrics_synced_at = current_timestamp(3), updated_at = current_timestamp(3)
       where id = ?`,
      [m.impressions, m.likes, m.retweets, row.id],
    );
    synced++;
  }
  return { synced };
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
        reply_quality_score = ?, auto_post_skip_reason = null,
        analyzed_at = current_timestamp(3), updated_at = current_timestamp(3)
       where id = ?`,
      [
        a.topic_type,
        JSON.stringify(a.tickers),
        a.summary_md,
        a.ops_angle_md,
        a.reply_draft,
        reply_draft_zh || null,
        a.reply_quality_score || null,
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
    const { reply_draft, reply_draft_zh, reply_quality_score } = await generateXWatchReply({
      username: item.source_username,
      tweetText: item.tweet_text,
      tweetUrl: item.tweet_url,
      topicType: item.topic_type,
      summaryMd: item.summary_md,
      opsAngleMd: item.ops_angle_md,
      currentDraft: item.reply_draft,
    });
    await mysqlQuery(
      `update x_watch_items set reply_draft = ?, reply_draft_zh = ?, reply_quality_score = ?, auto_post_skip_reason = null, updated_at = current_timestamp(3) where id = ?`,
      [reply_draft, reply_draft_zh, reply_quality_score || null, id],
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

export async function postXWatchQuoteReply(id: string): Promise<{
  ok: boolean;
  replyTweetId?: string;
  postMode?: XWatchPostMode;
  error?: string;
}> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };
  const text = item.reply_draft?.trim();
  if (!text) return { ok: false, error: "reply draft empty" };
  if (text.length > 280) return { ok: false, error: "reply exceeds 280 characters" };

  try {
    const { tweetId } = await postTweet(text, { quoteTweetId: item.tweet_id });
    await markXWatchPosted(id, tweetId, "quote");
    return { ok: true, replyTweetId: tweetId, postMode: "quote" };
  } catch (e) {
    const quoteErr = e instanceof Error ? e.message : "quote failed";
    try {
      const mentionText = withMention(item.source_username, text);
      const { tweetId } = await postTweet(mentionText);
      await markXWatchPosted(id, tweetId, "mention");
      return { ok: true, replyTweetId: tweetId, postMode: "mention" };
    } catch (e2) {
      const err = friendlyPostError(e2 instanceof Error ? e2.message : quoteErr);
      await markXWatchPostFailed(id, err);
      return { ok: false, error: err };
    }
  }
}

export async function tryAutoPostXWatchItem(id: string): Promise<"posted" | "skipped" | "failed"> {
  if (!isXWatchAutoReplyEnabled() || !isXPostingEnabled()) return "skipped";
  const item = await getXWatchItem(id);
  if (!item || item.status !== "pending") return "skipped";
  if (!shouldAutoReplyTopic(item.topic_type)) {
    await markAutoPostSkip(id, `topic ${item.topic_type ?? "other"}`);
    return "skipped";
  }
  if (!item.reply_draft?.trim()) {
    await markAutoPostSkip(id, "empty draft");
    return "skipped";
  }

  const minScore = autoReplyMinScore();
  const score = item.reply_quality_score ?? 0;
  if (score < minScore) {
    await markAutoPostSkip(id, `score ${score} < ${minScore}`);
    return "skipped";
  }

  const result = await postXWatchQuoteReply(id);
  return result.ok ? "posted" : "failed";
}

export async function postXWatchReply(id: string): Promise<{
  ok: boolean;
  replyTweetId?: string;
  postMode?: XWatchPostMode;
  error?: string;
}> {
  const item = await getXWatchItem(id);
  if (!item) return { ok: false, error: "not found" };
  if (item.status !== "pending") return { ok: false, error: "item not pending" };
  const text = item.reply_draft?.trim();
  if (!text) return { ok: false, error: "reply draft empty" };
  if (text.length > 280) return { ok: false, error: "reply exceeds 280 characters" };

  try {
    const { tweetId } = await postTweet(text, { replyToId: item.tweet_id });
    await markXWatchPosted(id, tweetId, "reply");
    return { ok: true, replyTweetId: tweetId, postMode: "reply" };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "post failed";
    const err = friendlyPostError(raw);
    await markXWatchPostFailed(id, err);
    return { ok: false, error: err };
  }
}

export async function getXWatchMeta(): Promise<{
  username: string;
  watchUsernames: string[];
  influencerMeta: ReturnType<typeof getWatchInfluencerMeta>;
  readConfigured: boolean;
  postConfigured: boolean;
  autoReplyEnabled: boolean;
  autoReplyMinScore: number;
  lastPolledAt: string | null;
  pendingCount: number;
}> {
  const usernames = watchUsernames();
  const influencerMeta = getWatchInfluencerMeta();
  const states = await Promise.all(
    usernames.filter((u) => u !== POLL_CURSOR_KEY).map((u) => getState(u)),
  );
  const lastPolled = states
    .map((s) => (s?.last_polled_at ? toIso(s.last_polled_at) : null))
    .filter(Boolean)
    .sort()
    .pop() ?? null;
  const [cnt] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from x_watch_items where status = 'pending'`,
  );
  return {
    username: usernames[0] ?? DEFAULT_X_WATCH_USERNAME,
    watchUsernames: usernames,
    influencerMeta,
    readConfigured: isXReadConfigured(),
    postConfigured: isXPostingEnabled(),
    autoReplyEnabled: isXWatchAutoReplyEnabled(),
    autoReplyMinScore: autoReplyMinScore(),
    lastPolledAt: lastPolled,
    pendingCount: Number(cnt?.n ?? 0),
  };
}
