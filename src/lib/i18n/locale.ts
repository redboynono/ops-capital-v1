import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "./locale-types";

export { htmlLang, isLocale, LOCALE_COOKIE, type Locale } from "./locale-types";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const h = await headers();
  const al = h.get("accept-language") ?? "";
  if (/\ben(-|;|,|$)/i.test(al)) return "en";
  return DEFAULT_LOCALE;
}
