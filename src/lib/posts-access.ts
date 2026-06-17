import { hasBriefAccess, hasResearchAccess } from "@/lib/entitlements";
import type { SessionUser } from "@/lib/auth";

export function isChokepointSlug(slug: string): boolean {
  return slug.startsWith("chokepoint-");
}

/** 深度研报是否可读全文（非喊单；Brief 仅卡点 franchise） */
export function canViewAnalysisFull(
  post: { slug: string; is_premium: number | boolean },
  user: SessionUser | null,
): boolean {
  if (!post.is_premium) return true;
  if (hasResearchAccess(user)) return true;
  if (isChokepointSlug(post.slug) && hasBriefAccess(user)) return true;
  return false;
}

export function paywallProductForPost(slug: string): "brief" | "research" {
  return isChokepointSlug(slug) ? "brief" : "research";
}
