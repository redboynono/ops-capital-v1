import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { mysqlQuery } from "@/lib/mysql";

const SESSION_COOKIE = "oc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

type DbUser = {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET");
  }
  return secret;
}

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function unbase64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function parseSessionToken(token: string): SessionPayload | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(unbase64url(payload)) as SessionPayload;
    if (!parsed.userId || !parsed.email || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setUserSession(userId: string, email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(JSON.stringify({ userId, email, exp }));
  const token = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = parseSessionToken(token);
  if (!payload) return null;

  const rows = await mysqlQuery<DbUser[]>(
    "select id, email, full_name, subscription_status, subscription_end_date from users where id = ? limit 1",
    [payload.userId],
  );

  const user = rows[0];
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    subscriptionStatus: user.subscription_status ?? "inactive",
    subscriptionEndDate: user.subscription_end_date,
  };
}
