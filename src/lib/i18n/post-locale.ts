import type { Locale } from "./locale-types";

type LocalizedPost = {
  title: string;
  title_en?: string | null;
  excerpt?: string | null;
  excerpt_en?: string | null;
  content?: string;
  content_en?: string | null;
};

export function postTitle(post: LocalizedPost, locale: Locale): string {
  if (locale === "en" && post.title_en?.trim()) return post.title_en.trim();
  return post.title;
}

export function postExcerpt(post: LocalizedPost, locale: Locale): string {
  if (locale === "en" && post.excerpt_en?.trim()) return post.excerpt_en.trim();
  return post.excerpt ?? "";
}

export function postContent(post: LocalizedPost, locale: Locale): string {
  if (locale === "en" && post.content_en?.trim()) return post.content_en.trim();
  return post.content ?? "";
}

export function hasEnglishBody(post: LocalizedPost): boolean {
  return !!post.content_en?.trim();
}
