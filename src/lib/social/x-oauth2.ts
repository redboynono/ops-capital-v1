import crypto from "node:crypto";
import { getXOAuth2Tokens, saveXOAuth2Tokens } from "@/lib/social/x-oauth2-store";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

type OAuth2Config = { clientId: string; clientSecret: string; redirectUri: string };

function readOAuth2Config(): OAuth2Config | null {
  const clientId = process.env.X_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.X_OAUTH2_CLIENT_SECRET?.trim();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://opscapital.com").replace(/\/$/, "");
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${site}/api/admin/x-oauth/callback`,
  };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function isXOAuth2Configured(): boolean {
  return readOAuth2Config() != null;
}

export function createPkcePair(): { verifier: string; challenge: string; state: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function buildXOAuth2AuthorizeUrl(challenge: string, state: string): string {
  const cfg = readOAuth2Config();
  if (!cfg) throw new Error("X OAuth2 client not configured");
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

type TokenResponse = {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function exchangeToken(body: URLSearchParams): Promise<TokenResponse> {
  const cfg = readOAuth2Config();
  if (!cfg) throw new Error("X OAuth2 client not configured");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(cfg.clientId, cfg.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return (await res.json().catch(() => ({}))) as TokenResponse;
}

export async function exchangeXOAuth2Code(code: string, verifier: string) {
  const cfg = readOAuth2Config();
  if (!cfg) throw new Error("X OAuth2 client not configured");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
    client_id: cfg.clientId,
  });
  const json = await exchangeToken(body);
  if (!json.access_token) {
    throw new Error(json.error_description || json.error || "token exchange failed");
  }
  const expiresAt =
    json.expires_in != null
      ? new Date(Date.now() + json.expires_in * 1000).toISOString().slice(0, 23).replace("T", " ")
      : null;
  await saveXOAuth2Tokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    scope: json.scope ?? null,
  });
  return json;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const json = await exchangeToken(body);
  if (!json.access_token) {
    throw new Error(json.error_description || json.error || "token refresh failed");
  }
  const expiresAt =
    json.expires_in != null
      ? new Date(Date.now() + json.expires_in * 1000).toISOString().slice(0, 23).replace("T", " ")
      : null;
  await saveXOAuth2Tokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt,
    scope: json.scope ?? null,
  });
  return json.access_token;
}

export async function getValidOAuth2AccessToken(): Promise<string | null> {
  const stored = await getXOAuth2Tokens();
  if (!stored) return null;
  const expiresMs = stored.expiresAt ? Date.parse(stored.expiresAt.replace(" ", "T")) : NaN;
  const stale = Number.isFinite(expiresMs) && expiresMs - Date.now() < 120_000;
  if (!stale) return stored.accessToken;
  if (!stored.refreshToken) return null;
  return refreshAccessToken(stored.refreshToken);
}

export async function postTweetOAuth2(text: string): Promise<{ tweetId: string; text: string }> {
  const token = await getValidOAuth2AccessToken();
  if (!token) throw new Error("X OAuth2 not authorized — visit /api/admin/x-oauth/start");

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
