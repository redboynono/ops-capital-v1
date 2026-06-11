import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { localeFromLandingSignals } from "@/lib/i18n/locale";
import { LOCALE_COOKIE, LOCALE_HEADER } from "@/lib/i18n/locale-types";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const locale = localeFromLandingSignals(
    request.nextUrl.searchParams.get("lang"),
    request.nextUrl.searchParams.get("utm_source"),
  );
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
