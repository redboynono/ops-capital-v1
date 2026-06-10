import type { Dictionary } from "./zh";
import type { Locale } from "./locale-types";
import { fmt } from "./fmt";

export function formatDate(locale: Locale, iso: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN");
}

export function formatRelative(
  locale: Locale,
  iso: string,
  t: Dictionary["common"],
): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return t.justNow;
  if (m < 60) return fmt(t.minutesAgoFmt, { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return fmt(t.hoursAgoFmt, { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return fmt(t.daysAgoFmt, { n: d });
  return formatDate(locale, iso);
}
