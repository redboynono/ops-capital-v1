import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { localeFromLandingSignals } from "@/lib/i18n/locale";
import { isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "@/lib/i18n/locale-types";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const explicitLang = params.get("lang");
  // 用户是否已有语言偏好（手动切换 / 早先落地写入）
  const hasUserPref = isLocale(request.cookies.get(LOCALE_COOKIE)?.value);

  let locale: Locale | null = null;
  if (isLocale(explicitLang)) {
    // 显式 ?lang= 始终优先（如邮件简报里的定向链接）
    locale = explicitLang;
  } else if (!hasUserPref) {
    // 仅当用户尚无语言偏好时，才用落地信号兜底（如 X→英文）。
    // 否则保留用户已选语言，避免 utm_source=x 每次请求都把 cookie 覆盖回英文、
    // 导致顶部语言切换永远切不动。
    locale = localeFromLandingSignals(null, params.get("utm_source"));
  }

  if (!locale) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
