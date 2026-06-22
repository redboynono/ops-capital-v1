import { getValidOAuth2AccessToken } from "@/lib/social/x-oauth2";

export type XTimelineTweet = {
  id: string;
  text: string;
  createdAt: string;
  conversationId: string | null;
};

type XApiError = { message?: string; detail?: string };

async function xBearer(): Promise<string | null> {
  const oauth = await getValidOAuth2AccessToken();
  if (oauth) return oauth;
  return process.env.X_BEARER_TOKEN?.trim() ?? null;
}

async function xGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await xBearer();
  if (!token) {
    throw new Error(
      "X read API not configured — set X_BEARER_TOKEN or authorize OAuth2 at /api/admin/x-oauth/start",
    );
  }
  const u = new URL(`https://api.twitter.com/2${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    errors?: XApiError[];
    detail?: string;
    title?: string;
  };
  if (!res.ok) {
    const msg =
      json.errors?.map((e) => e.detail || e.message).filter(Boolean).join("; ") ||
      json.detail ||
      json.title ||
      `X API HTTP ${res.status}`;
    throw new Error(`${msg} (HTTP ${res.status})`);
  }
  return json;
}

export async function resolveXUserId(username: string): Promise<{ id: string; username: string; name: string }> {
  const handle = username.replace(/^@/, "").trim();
  const json = await xGet<{
    data?: { id: string; username: string; name: string };
  }>(`/users/by/username/${encodeURIComponent(handle)}`, {
    "user.fields": "id,username,name",
  });
  if (!json.data?.id) throw new Error(`X user @${handle} not found`);
  return json.data;
}

/** Recent original posts (no replies/retweets). */
export async function fetchUserTimeline(
  userId: string,
  opts?: { maxResults?: number; sinceId?: string },
): Promise<XTimelineTweet[]> {
  const params: Record<string, string> = {
    max_results: String(Math.min(Math.max(opts?.maxResults ?? 10, 5), 100)),
    "tweet.fields": "created_at,conversation_id",
    exclude: "retweets,replies",
  };
  if (opts?.sinceId) params.since_id = opts.sinceId;

  const json = await xGet<{
    data?: { id: string; text: string; created_at?: string; conversation_id?: string }[];
    meta?: { newest_id?: string; oldest_id?: string; result_count?: number };
  }>(`/users/${userId}/tweets`, params);

  return (json.data ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    createdAt: t.created_at ?? new Date().toISOString(),
    conversationId: t.conversation_id ?? null,
  }));
}

export type XTweetMetrics = {
  id: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
};

/** Batch-fetch public_metrics for our posted quote/reply tweets. */
export async function fetchTweetMetrics(tweetIds: string[]): Promise<Map<string, XTweetMetrics>> {
  const ids = [...new Set(tweetIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  const out = new Map<string, XTweetMetrics>();
  if (ids.length === 0) return out;

  const json = await xGet<{
    data?: {
      id: string;
      public_metrics?: {
        impression_count?: number;
        like_count?: number;
        retweet_count?: number;
        reply_count?: number;
      };
    }[];
  }>(`/tweets`, {
    ids: ids.join(","),
    "tweet.fields": "public_metrics",
  });

  for (const t of json.data ?? []) {
    const m = t.public_metrics;
    out.set(t.id, {
      id: t.id,
      impressions: Number(m?.impression_count ?? 0),
      likes: Number(m?.like_count ?? 0),
      retweets: Number(m?.retweet_count ?? 0),
      replies: Number(m?.reply_count ?? 0),
    });
  }
  return out;
}

export function isXReadConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN?.trim()) || Boolean(process.env.X_OAUTH2_CLIENT_ID?.trim());
}
