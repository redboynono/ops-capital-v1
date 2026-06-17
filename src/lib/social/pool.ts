import { listPosts } from "@/lib/posts";
import { listRecentRatingChanges } from "@/lib/rating-changes";
import { AI_VALUE_CHAIN_LAYERS } from "@/lib/marketing/ai-value-chain";
import {
  buildAnalysisThreadVariants,
  buildAnalysisXVariants,
  buildSocialCopyAsync,
  type LocalizedXPost,
  type XThread,
} from "@/lib/social/copy";
import { listSocialOpsRecords } from "@/lib/social/records";

export type SocialPoolItem = {
  key: string;
  contentType: "analysis" | "news" | "rating_change" | "value_chain" | "custom";
  refKey: string;
  title: string;
  subtitle: string;
  priority: number;
  xCopy: string;
  xhsCopy: string;
  xUrl: string;
  xhsUrl: string;
  utmCampaign: string;
  shortCode?: string;
  /** 多语言变体：每条内容发中/英两条 X，分别落地中文版/英文版 */
  xVariants?: LocalizedXPost[];
  /** 叙事 thread 变体（六层框架钩子）；优先于 xVariants 发送 */
  xThreads?: XThread[];
};

const ANALYSIS_REPOST_COOLDOWN_DAYS = 30;

function alreadyDrafted(
  drafted: Set<string>,
  contentType: string,
  refKey: string,
): boolean {
  return drafted.has(`${contentType}:${refKey}`);
}

function toPoolItem(
  key: string,
  contentType: SocialPoolItem["contentType"],
  refKey: string,
  title: string,
  subtitle: string,
  priority: number,
  copy: Awaited<ReturnType<typeof buildSocialCopyAsync>>,
): SocialPoolItem {
  return {
    key,
    contentType,
    refKey,
    title,
    subtitle,
    priority,
    xCopy: copy.xCopy,
    xhsCopy: copy.xhsCopy,
    xUrl: copy.xUrl,
    xhsUrl: copy.xhsUrl,
    utmCampaign: copy.utmCampaign,
    shortCode: copy.shortCode,
  };
}

function postedAnalysisSlugs(
  records: Awaited<ReturnType<typeof listSocialOpsRecords>>,
): Set<string> {
  const cutoff = Date.now() - ANALYSIS_REPOST_COOLDOWN_DAYS * 86_400_000;
  const slugs = new Set<string>();
  for (const r of records) {
    if (r.content_type !== "analysis" || !r.posted_x_at || !r.ref_key) continue;
    const t = Date.parse(r.posted_x_at.replace(" ", "T"));
    if (Number.isFinite(t) && t >= cutoff) slugs.add(r.ref_key);
  }
  return slugs;
}

function englishScore(p: { title_en?: string | null; excerpt_en?: string | null }): number {
  let s = 0;
  if (p.title_en?.trim()) s += 2;
  if (p.excerpt_en?.trim()) s += 3;
  return s;
}

/** 深度研报英文 X 池：优先有 title_en + excerpt_en 的最新文章 */
export async function buildAnalysisSocialPool(limit = 10): Promise<SocialPoolItem[]> {
  const [posts, records] = await Promise.all([
    listPosts({ kind: "analysis", limit: 40, period: "month" }),
    listSocialOpsRecords({ limit: 500 }),
  ]);

  const blocked = postedAnalysisSlugs(records);
  const sorted = [...posts].sort((a, b) => {
    const diff = englishScore(b) - englishScore(a);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const items: SocialPoolItem[] = [];
  for (const p of sorted) {
    if (blocked.has(p.slug)) continue;
    const copy = await buildSocialCopyAsync({
      type: "post",
      kind: "analysis",
      title: p.title,
      title_en: p.title_en,
      slug: p.slug,
      excerpt: p.excerpt,
      excerpt_en: p.excerpt_en,
      tickers: p.tickers,
    });
    const enTitle = p.title_en?.trim() || p.title;
    const item = toPoolItem(
      `analysis:${p.slug}`,
      "analysis",
      p.slug,
      enTitle,
      p.excerpt_en?.slice(0, 120) || p.excerpt?.slice(0, 100) || "Deep research",
      90 + englishScore(p),
      copy,
    );
    const variantInput = {
      type: "post" as const,
      kind: "analysis" as const,
      title: p.title,
      title_en: p.title_en,
      slug: p.slug,
      excerpt: p.excerpt,
      excerpt_en: p.excerpt_en,
      tickers: p.tickers,
    };
    item.xVariants = await buildAnalysisXVariants(variantInput);
    item.xThreads = await buildAnalysisThreadVariants(variantInput);
    items.push(item);
    if (items.length >= limit) break;
  }
  return items;
}

export async function buildSocialContentPool(limit = 12): Promise<SocialPoolItem[]> {
  const [news, analysis, changes, records] = await Promise.all([
    listPosts({ kind: "news", limit: 10, period: "week" }),
    listPosts({ kind: "analysis", limit: 6, period: "month" }),
    listRecentRatingChanges({ sinceHours: 96, limit: 8 }),
    listSocialOpsRecords({ limit: 100 }),
  ]);

  const drafted = new Set(
    records
      .filter((r) => r.status !== "done")
      .map((r) => `${r.content_type}:${r.ref_key ?? ""}`),
  );

  const items: SocialPoolItem[] = [];

  for (const c of changes.slice(0, 4)) {
    const refKey = c.symbol;
    if (alreadyDrafted(drafted, "rating_change", refKey)) continue;
    const copy = await buildSocialCopyAsync({ type: "rating_change", change: c });
    items.push(
      toPoolItem(
        `rating:${refKey}`,
        "rating_change",
        refKey,
        copy.title,
        `${c.label} · ${c.from_value ?? "—"} → ${c.to_value ?? "—"}`,
        95,
        copy,
      ),
    );
  }

  for (const p of news.slice(0, 5)) {
    const refKey = p.slug;
    if (alreadyDrafted(drafted, "news", refKey)) continue;
    const copy = await buildSocialCopyAsync({
      type: "post",
      kind: "news",
      title: p.title,
      title_en: p.title_en,
      slug: p.slug,
      excerpt: p.excerpt,
      excerpt_en: p.excerpt_en,
      tickers: p.tickers,
    });
    items.push(
      toPoolItem(
        `news:${refKey}`,
        "news",
        refKey,
        p.title,
        p.excerpt?.slice(0, 100) ?? "市场快讯",
        80,
        copy,
      ),
    );
  }

  for (const p of analysis.slice(0, 3)) {
    const refKey = p.slug;
    if (alreadyDrafted(drafted, "analysis", refKey)) continue;
    const copy = await buildSocialCopyAsync({
      type: "post",
      kind: "analysis",
      title: p.title,
      title_en: p.title_en,
      slug: p.slug,
      excerpt: p.excerpt,
      excerpt_en: p.excerpt_en,
      tickers: p.tickers,
    });
    items.push(
      toPoolItem(
        `analysis:${refKey}`,
        "analysis",
        refKey,
        p.title,
        p.excerpt?.slice(0, 100) ?? "深度研报",
        70,
        copy,
      ),
    );
  }

  for (const layer of AI_VALUE_CHAIN_LAYERS) {
    const refKey = layer.id;
    if (alreadyDrafted(drafted, "value_chain", refKey)) continue;
    const copy = await buildSocialCopyAsync({ type: "value_chain", layer });
    items.push(
      toPoolItem(
        `layer:${refKey}`,
        "value_chain",
        refKey,
        copy.title,
        layer.trend2026.slice(0, 90) + "…",
        55,
        copy,
      ),
    );
  }

  const pricingCopy = await buildSocialCopyAsync({
    type: "custom",
    title: "OPS Alpha · AI & semiconductor research terminal",
    path: "/pricing",
    excerpt:
      "Institutional-grade AI research for semiconductors & compute. Six-layer value chain (L0–L5), OPS ratings, deep research, and daily news. New users: 7-day free trial on Research Pro.",
  });
  items.push(
    toPoolItem(
      "cta:pricing",
      "custom",
      "pricing_cta",
      "OPS Alpha · 7 天免费试用",
      "转化帖 · 引导注册试用",
      40,
      pricingCopy,
    ),
  );

  return items.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
