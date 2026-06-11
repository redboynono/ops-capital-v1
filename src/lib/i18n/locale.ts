import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
} from "./locale-types";

export { htmlLang, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./locale-types";

/** 从 ?lang= 或 utm_source=x 解析落地语言（供 proxy 使用） */
export function localeFromLandingSignals(
  lang: string | null,
  utmSource: string | null,
): Locale | null {
  if (isLocale(lang)) return lang;
  if (utmSource === "x") return "en";
  return null;
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
