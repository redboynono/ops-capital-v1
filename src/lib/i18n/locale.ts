import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
} from "./locale-types";

export { htmlLang, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./locale-types";

/** 从 ?lang= 或 utm_source=x 解析落地语言（供 proxy / 短链重定向使用） */
export function localeFromLandingSignals(
  lang: string | null,
  utmSource: string | null,
): Locale | null {
  if (isLocale(lang)) return lang;
  if (utmSource === "x") return "en";
  return null;
}

export function localeFromLandingUrl(url: string): Locale | null {
  try {
    const u = new URL(url);
    return localeFromLandingSignals(
      u.searchParams.get("lang"),
      u.searchParams.get("utm_source"),
    );
  } catch {
    return null;
  }
}

const LOCALE_COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/** 在重定向响应上写入落地语言 cookie */
export function applyLandingLocaleCookie(res: NextResponse, landingUrl: string): NextResponse {
  const locale = localeFromLandingUrl(landingUrl);
  if (!locale) return res;
  res.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTS);
  return res;
}

export async function getLocale(): Promise<Locale> {
  const h = await headers();
  const fromProxy = h.get(LOCALE_HEADER);
  if (isLocale(fromProxy)) return fromProxy;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const al = h.get("accept-language") ?? "";
  if (/\ben(-|;|,|$)/i.test(al)) return "en";
  return DEFAULT_LOCALE;
}
