/** US options expiry helpers (America/New_York calendar dates). */

export type ExpiryWeek = "this" | "next";

export function tradingTodayInNy(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Nearest Friday on or after `from` (if `from` is Friday, returns same day). */
export function thisFridayIso(from?: string): string {
  const today = from ?? tradingTodayInNy();
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const daysUntilFriday = (5 - dow + 7) % 7;
  return addDaysIso(today, daysUntilFriday);
}

export function nextFridayIso(from?: string): string {
  return addDaysIso(thisFridayIso(from), 7);
}

export function resolveExpirySelection(params?: {
  week?: string;
  exp?: string;
}): {
  expirationDate: string;
  week: ExpiryWeek;
  label: string;
  thisFriday: string;
  nextFriday: string;
} {
  const thisFriday = thisFridayIso();
  const nextFriday = nextFridayIso();

  if (params?.exp && /^\d{4}-\d{2}-\d{2}$/.test(params.exp)) {
    const label =
      params.exp === thisFriday ? "本周五" : params.exp === nextFriday ? "下周五" : params.exp;
    return {
      expirationDate: params.exp,
      week: params.exp === nextFriday ? "next" : "this",
      label,
      thisFriday,
      nextFriday,
    };
  }

  const week: ExpiryWeek = params?.week === "next" ? "next" : "this";
  const expirationDate = week === "next" ? nextFriday : thisFriday;
  return {
    expirationDate,
    week,
    label: week === "next" ? "下周五" : "本周五",
    thisFriday,
    nextFriday,
  };
}

export function buildExpiringOptionsQuery(opts: {
  week?: ExpiryWeek;
  symbol?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.week) q.set("week", opts.week);
  if (opts.symbol) q.set("symbol", opts.symbol);
  const s = q.toString();
  return s ? `?${s}` : "";
}
