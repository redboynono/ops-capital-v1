import { en } from "./en";
import type { Dictionary } from "./zh";
import { zh } from "./zh";
import type { Locale } from "./locale-types";

const MAP: Record<Locale, Dictionary> = { zh, en };

export function getDictionary(locale: Locale): Dictionary {
  return MAP[locale] ?? zh;
}

export function pick<T>(locale: Locale, zhVal: T, enVal: T): T {
  return locale === "en" ? enVal : zhVal;
}
