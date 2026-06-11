import { siteUrl } from "@/lib/seo";

export function withUtm(
  path: string,
  opts: { source: "x" | "xhs"; campaign?: string; medium?: string },
): string {
  const base = path.startsWith("http") ? path : siteUrl(path);
  const u = new URL(base);
  u.searchParams.set("utm_source", opts.source);
  u.searchParams.set("utm_medium", opts.medium ?? "social");
  if (opts.campaign) u.searchParams.set("utm_campaign", opts.campaign);
  if (opts.source === "x") u.searchParams.set("lang", "en");
  return u.toString();
}

export function slugifyCampaign(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}
