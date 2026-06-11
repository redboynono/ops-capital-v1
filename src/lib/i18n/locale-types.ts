export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "ops_lang";
/** proxy 注入，同请求内让 getLocale 识别 X / ?lang= 落地 */
export const LOCALE_HEADER = "x-ops-locale";
export const DEFAULT_LOCALE: Locale = "zh";

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "zh" || v === "en";
}

export function htmlLang(locale: Locale): string {
  return locale === "en" ? "en" : "zh-CN";
}
