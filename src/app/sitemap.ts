import type { MetadataRoute } from "next";
import { listPublishedSlugsForSitemap } from "@/lib/posts";
import { mysqlQuery } from "@/lib/mysql";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/login"), changeFrequency: "monthly", priority: 0.5 },
    { url: siteUrl("/alpha"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/analysis"), changeFrequency: "daily", priority: 0.85 },
    { url: siteUrl("/news"), changeFrequency: "hourly", priority: 0.85 },
    { url: siteUrl("/picks"), changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl("/tickers"), changeFrequency: "daily", priority: 0.8 },
    { url: siteUrl("/screener"), changeFrequency: "daily", priority: 0.75 },
    { url: siteUrl("/pricing"), changeFrequency: "monthly", priority: 0.7 },
  ];

  const [posts, tickers] = await Promise.all([
    listPublishedSlugsForSitemap().catch(() => []),
    mysqlQuery<{ symbol: string }[]>("select symbol from tickers order by symbol").catch(() => []),
  ]);

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: siteUrl(p.kind === "news" ? `/news/${p.slug}` : `/analysis/${p.slug}`),
    lastModified: new Date(p.created_at),
    changeFrequency: p.kind === "news" ? "weekly" : "monthly",
    priority: p.kind === "news" ? 0.7 : 0.75,
  }));

  const tickerEntries: MetadataRoute.Sitemap = tickers.map((t) => ({
    url: siteUrl(`/t/${t.symbol}`),
    changeFrequency: "daily",
    priority: 0.65,
  }));

  return [...staticRoutes, ...postEntries, ...tickerEntries];
}
