import { siteUrl } from "@/lib/seo";

export const X_LANDING_PATH = "/start";

export function withUtm(
  path: string,
  opts: { source: "x" | "xhs"; campaign?: string; medium?: string; lang?: "zh" | "en" },
): string {
  const base = path.startsWith("http") ? path : siteUrl(path);
  const u = new URL(base);
  u.searchParams.set("utm_source", opts.source);
  u.searchParams.set("utm_medium", opts.medium ?? "social");
  if (opts.campaign) u.searchParams.set("utm_campaign", opts.campaign);
  // 显式 lang 优先；否则 X 链接历史默认英文落地
  if (opts.lang) u.searchParams.set("lang", opts.lang);
  else if (opts.source === "x") u.searchParams.set("lang", "en");
  return u.toString();
}

export function slugifyCampaign(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}
