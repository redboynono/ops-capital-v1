import crypto from "node:crypto";

export type XPostResult = {
  tweetId: string;
  text: string;
};

export type XApiConfig = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const norm = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join("&");
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(norm)].join("&");
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac("sha1", key).update(base).digest("base64");
}

function readXConfig(): XApiConfig | null {
  const apiKey = process.env.X_API_KEY?.trim();
  const apiSecret = process.env.X_API_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim();
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) return null;
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

export function isXPostingEnabled(): boolean {
  if (process.env.X_AUTO_POST_ENABLED === "0") return false;
  return readXConfig() != null;
}

/** 发布一条 X 推文（OAuth 1.0a User Context） */
export async function postTweet(text: string): Promise<XPostResult> {
  const cfg = readXConfig();
  if (!cfg) {
    throw new Error("X API credentials missing (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET)");
  }

  const url = "https://api.twitter.com/2/tweets";
  const oauthNonce = crypto.randomBytes(16).toString("hex");
  const oauthTimestamp = String(Math.floor(Date.now() / 1000));

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: cfg.apiKey,
    oauth_nonce: oauthNonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: oauthTimestamp,
    oauth_token: cfg.accessToken,
    oauth_version: "1.0",
  };

  const signature = oauthSignature("POST", url, oauthParams, cfg.apiSecret, cfg.accessTokenSecret);
  const signed = { ...oauthParams, oauth_signature: signature };
  const header =
    "OAuth " +
    Object.keys(signed)
      .sort()
      .map((k) => `${k}="${percentEncode(signed[k as keyof typeof signed]!)}"`)
      .join(", ");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: header,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; text?: string };
    errors?: { message?: string; detail?: string }[];
    detail?: string;
  };

  if (!res.ok) {
    const msg =
      json.errors?.map((e) => e.detail || e.message).filter(Boolean).join("; ") ||
      json.detail ||
      `X API HTTP ${res.status}`;
    throw new Error(`${msg} (HTTP ${res.status})`);
  }

  const tweetId = json.data?.id;
  if (!tweetId) throw new Error("X API returned no tweet id");
  return { tweetId, text: json.data?.text ?? text };
}
