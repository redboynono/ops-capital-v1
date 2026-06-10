export type Locale = "zh" | "en";

export const LOCALE_COOKIE = "ops_lang";
export const DEFAULT_LOCALE: Locale = "zh";

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "zh" || v === "en";
}

export function htmlLang(locale: Locale): string {
  return locale === "en" ? "en" : "zh-CN";
}
