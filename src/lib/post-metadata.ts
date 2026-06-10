import type { Metadata } from "next";
import { ogImageUrl, siteUrl } from "@/lib/seo";
import type { PostRow } from "@/lib/posts";

export function buildPostMetadata(post: PostRow, pathPrefix: "analysis" | "news"): Metadata {
  const path = `/${pathPrefix}/${post.slug}`;
  return {
    title: `${post.title} · OPS Alpha`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: siteUrl(path),
      siteName: "OPS Alpha",
      type: "article",
      publishedTime: post.created_at,
      images: [{ url: ogImageUrl(post.title, post.excerpt), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImageUrl(post.title, post.excerpt)],
    },
  };
}
