import { listPosts } from "@/lib/posts";
import { listRecentRatingChanges } from "@/lib/rating-changes";
import { AI_VALUE_CHAIN_LAYERS } from "@/lib/marketing/ai-value-chain";
import { buildSocialCopyAsync } from "@/lib/social/copy";
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
};

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
      slug: p.slug,
      excerpt: p.excerpt,
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
      slug: p.slug,
      excerpt: p.excerpt,
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
    excerpt: "7-day free trial · Ratings, deep research, daily news · L0–L5 value chain.",
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
