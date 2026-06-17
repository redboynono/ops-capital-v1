import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { mysqlQuery } from "@/lib/mysql";
import { resolveEntitlements } from "@/lib/entitlements";
import { reconcileExpiredSubscription } from "@/lib/subscription";

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
  entitlement_brief: number | null;
  entitlement_research: number | null;
  entitlement_options: number | null;
  email_briefing_enabled: number | null;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  entitlementBrief: boolean;
  entitlementResearch: boolean;
  entitlementOptions: boolean;
  emailBriefingEnabled: boolean;
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

function subscriptionLooksExpired(u: DbUser): boolean {
  if (u.subscription_status !== "active" || !u.subscription_end_date) return false;
  const end = new Date(u.subscription_end_date);
  return !Number.isNaN(end.getTime()) && end <= new Date();
}

function toSessionUser(u: DbUser): SessionUser {
  const ent = resolveEntitlements({
    subscription_status: u.subscription_status,
    subscription_end_date: u.subscription_end_date,
    entitlement_brief: u.entitlement_brief,
    entitlement_research: u.entitlement_research,
    entitlement_options: u.entitlement_options,
  });

  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    subscriptionStatus: u.subscription_status ?? "inactive",
    subscriptionEndDate: u.subscription_end_date,
    entitlementBrief: ent.brief,
    entitlementResearch: ent.research,
    entitlementOptions: ent.options,
    emailBriefingEnabled: Number(u.email_briefing_enabled ?? 0) === 1,
  };
}

async function loadSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = parseSessionToken(token);
  if (!payload) return null;

  const rows = await mysqlQuery<DbUser[]>(
    `select id, email, full_name, subscription_status, subscription_end_date,
            entitlement_brief, entitlement_research, entitlement_options, email_briefing_enabled
       from users where id = ? limit 1`,
    [payload.userId],
  );

  let user = rows[0];
  if (!user) return null;

  if (subscriptionLooksExpired(user)) {
    await reconcileExpiredSubscription(user.id);
    const refreshed = await mysqlQuery<DbUser[]>(
      `select id, email, full_name, subscription_status, subscription_end_date,
              entitlement_brief, entitlement_research, entitlement_options, email_briefing_enabled
         from users where id = ? limit 1`,
      [user.id],
    );
    user = refreshed[0] ?? user;
  }

  return toSessionUser(user);
}

/** 同一次请求内 layout / 页面 / 侧栏共用，避免重复查库 */
export const getSessionUser = cache(loadSessionUser);

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
