const BASE = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://opscapital.com").replace(/\/$/, "");

export function siteUrl(path = ""): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function ogImageUrl(title: string, subtitle?: string): string {
  const q = new URLSearchParams({ title: title.slice(0, 80) });
  if (subtitle) q.set("subtitle", subtitle.slice(0, 120));
  return `${BASE}/api/og?${q.toString()}`;
}
