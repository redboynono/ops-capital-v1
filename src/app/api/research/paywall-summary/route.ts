import { NextResponse } from "next/server";

import { getPostBySlug } from "@/lib/posts";
import { postContent, postTitle } from "@/lib/i18n/post-locale";
import { getOrCreatePaywallSummary } from "@/lib/ai/paywall-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 公开端点：返回某篇文章的「AI 一句话结论」（付费墙钩子）。
 * 匿名可访问；按 post+lang 缓存，仅首个未命中的访客触发一次生成。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") ?? "").trim();
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh";
  if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

  const post = await getPostBySlug(slug);
  if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });

  const body = postContent(post, lang) || post.content;
  const title = postTitle(post, lang) || post.title;

  const summary = await getOrCreatePaywallSummary({
    postId: post.id,
    lang,
    title,
    body,
  });

  return NextResponse.json(
    { summary: summary ?? null },
    {
      headers: {
        // 命中后可被 CDN/浏览器缓存，降低重复请求
        "Cache-Control": summary ? "public, max-age=600, s-maxage=86400" : "no-store",
      },
    },
  );
}
