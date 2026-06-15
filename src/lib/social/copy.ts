import { buildShareBundle, type ShareInput } from "@/lib/share/payload";
import type { ValueChainLayer } from "@/lib/marketing/ai-value-chain";
import type { RatingChange } from "@/lib/rating-changes";
import { X_CHAR_LIMIT } from "@/lib/social/constants";
import { getOrCreateShortLink } from "@/lib/social/short-link";
import { withUtm, slugifyCampaign } from "@/lib/social/utm";

export { X_CHAR_LIMIT, X_PREMIUM_TARGET } from "@/lib/social/constants";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "LINK"]);

const RESEARCH_SECTIONS = [
  "Macro & liquidity mapping",
  "Fundamentals & competitive moat",
  "Catalysts & valuation framework",
  "Tail risks & position sizing",
];

function xLen(s: string): number {
  return [...s].length;
}

function truncateX(s: string, max: number): string {
  if (xLen(s) <= max) return s;
  return [...s].slice(0, Math.max(0, max - 1)).join("") + "…";
}

function pickEn(zh: string, en?: string | null): string {
  return (en?.trim() || zh).replace(/\s+/g, " ").trim();
}

/** 长文摘要：英文优先，最多 5 句 / 520 字 */
export function extractCoreSummary(excerpt?: string, excerptEn?: string | null): string {
  const useEn = !!excerptEn?.trim();
  const raw = (excerptEn?.trim() || excerpt || "").replace(/^BLUF:\s*/i, "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const splitRe = useEn ? /(?<=[.!?])\s+/ : /(?<=[。！？!?])\s*/;
  const sentences = raw.split(splitRe).filter(Boolean);
  const maxSentences = useEn ? 5 : 3;
  const core = (sentences.slice(0, maxSentences).join(useEn ? " " : "") || raw).trim();
  return useEn ? truncateX(core, 520) : truncateX(core, 280);
}

const VERDICT_EN: Record<string, string> = {
  STRONG_BUY: "Strong Buy",
  BUY: "Buy",
  HOLD: "Hold",
  SELL: "Sell",
  STRONG_SELL: "Strong Sell",
  强买: "Strong Buy",
  买入: "Buy",
  持有: "Hold",
  卖出: "Sell",
  强卖: "Strong Sell",
};

const RATING_LABEL_EN: Record<string, string> = {
  首次覆盖: "Initiated coverage",
  "OPS 评级": "OPS rating",
  "OPS 目标价": "OPS target",
  "Quant 评分": "Quant score",
};

function enRatingValue(v: string | null): string {
  if (!v || v === "—") return "—";
  return VERDICT_EN[v] ?? v;
}

function enRatingLabel(label: string): string {
  return RATING_LABEL_EN[label] ?? label;
}

/** 页脚只用 # 标签；正文保留唯一 $TICKER（X 限制每条 1 个 cashtag） */
function xHashtags(tickers: string[] = [], extra: string[] = []): string {
  const tags = new Set<string>();
  if (tickers[0]) tags.add(`#${tickers[0]}`);
  for (const t of extra) tags.add(t);
  if (tickers.some((t) => CRYPTO_TICKERS.has(t))) tags.add("#Crypto");
  tags.add("#AI");
  tags.add("#Semiconductors");
  tags.add("#OPS Alpha");
  return [...tags].slice(0, 6).join(" ");
}

type PremiumXBlock = {
  lines: string[];
  url: string;
  tickers?: string[];
  extraTags?: string[];
};

/** Premium 长文：结构化多段，仅在极端超长时兜底截断 */
function buildPremiumXCopy(block: PremiumXBlock): string {
  const tags = xHashtags(block.tickers, block.extraTags);
  const footer = `\n\n${block.url}\n\n${tags}`;
  let body = block.lines.filter(Boolean).join("\n\n");
  const maxBody = X_CHAR_LIMIT - xLen(footer) - 1;
  if (xLen(body) > maxBody) body = truncateX(body, maxBody);
  return `${body}${footer}`;
}

function xUrlForPost(path: string, campaign: string): string {
  return withUtm(path, { source: "x", campaign, medium: "social" });
}

function pathForInput(input: SocialCopyInput): { path: string; refKey: string } {
  if (input.type === "post") {
    return {
      path: `/${input.kind === "analysis" ? "analysis" : "news"}/${input.slug}`,
      refKey: input.slug,
    };
  }
  if (input.type === "rating_change") {
    return { path: `/t/${input.change.symbol}`, refKey: input.change.symbol };
  }
  if (input.type === "value_chain") {
    return { path: "/#value-chain", refKey: `vc_${input.layer.id}` };
  }
  return { path: input.path, refKey: slugifyCampaign(input.title) };
}

function buildXCopy(input: SocialCopyInput, xUrl: string): string {
  if (input.type === "post") {
    const ticker = input.tickers?.[0];
    const title = pickEn(input.title, input.title_en);
    const thesis = extractCoreSummary(input.excerpt, input.excerpt_en);

    if (input.kind === "news") {
      const lines = [
        "⚡ Market flash · OPS Alpha",
        ticker ? `$${ticker} · ${title}` : title,
        thesis ? `Context\n${thesis}` : undefined,
        "Full note at the link below.",
      ].filter((l): l is string => !!l);
      return buildPremiumXCopy({
        lines,
        url: xUrl,
        tickers: input.tickers,
        extraTags: ["#Markets"],
      });
    }

    const lines = [
      "🔬 Deep research · OPS Alpha",
      ticker ? `$${ticker} · ${title}` : title,
      thesis ? `Thesis\n${thesis}` : "New institutional-grade research is live.",
      `What's inside\n${RESEARCH_SECTIONS.map((s) => `· ${s}`).join("\n")}`,
      "Free summary on site · full report & valuation framework with Research Pro.",
    ];
    return buildPremiumXCopy({
      lines,
      url: xUrl,
      tickers: input.tickers,
      extraTags: ["#DeepResearch", "#FinTwit"],
    });
  }

  if (input.type === "rating_change") {
    const { change } = input;
    const lines = [
      "📊 Rating update · OPS Alpha",
      `$${change.symbol}${change.name ? ` · ${change.name}` : ""}`,
      `${enRatingLabel(change.label)}: ${enRatingValue(change.from_value)} → ${enRatingValue(change.to_value)}`,
      change.ai_note?.trim() ? `Note\n${change.ai_note.trim()}` : undefined,
      "Factsheet, factor grades & OPS history at the link.",
    ].filter((l): l is string => !!l);
    return buildPremiumXCopy({
      lines,
      url: xUrl,
      tickers: [change.symbol],
      extraTags: ["#Ratings"],
    });
  }

  if (input.type === "value_chain") {
    const { layer } = input;
    const reps = layer.representatives
      .slice(0, 5)
      .map((r) => (r.symbol ? `${r.name} (${r.symbol})` : r.name))
      .join(" · ");
    const lines = [
      `🧱 AI Value Chain · ${layer.id}`,
      `${layer.nameEn} · ${layer.roleEn}`,
      `2026 setup\n${layer.trend2026En}`,
      reps ? `Names to watch\n${reps}` : undefined,
      "Explore the full L0–L5 framework on OPS Capital.",
    ].filter((l): l is string => !!l);
    return buildPremiumXCopy({
      lines,
      url: xUrl,
      tickers: layer.representatives.map((r) => r.symbol).filter(Boolean) as string[],
      extraTags: ["#ValueChain"],
    });
  }

  const title = pickEn(input.title, input.title_en);
  const thesis = input.excerpt
    ? extractCoreSummary(input.excerpt, input.excerpt_en)
    : "";
  const lines = [
    "OPS Alpha",
    title,
    thesis || undefined,
  ].filter((l): l is string => !!l);
  return buildPremiumXCopy({
    lines,
    url: xUrl,
    extraTags: ["#FinTwit"],
  });
}

export type SocialCopyInput =
  | {
      type: "post";
      kind: "analysis" | "news";
      title: string;
      title_en?: string | null;
      slug: string;
      excerpt?: string;
      excerpt_en?: string | null;
      tickers?: string[];
    }
  | { type: "rating_change"; change: RatingChange }
  | { type: "value_chain"; layer: ValueChainLayer }
  | { type: "custom"; title: string; path: string; excerpt?: string; title_en?: string | null; excerpt_en?: string | null };

export type SocialCopyBundle = {
  title: string;
  canonicalUrl: string;
  xUrl: string;
  xhsUrl: string;
  xCopy: string;
  xhsCopy: string;
  utmCampaign: string;
  shortCode?: string;
};

function postShareInput(input: Extract<SocialCopyInput, { type: "post" }>): ShareInput {
  return {
    type: "post",
    kind: input.kind,
    title: input.title,
    excerpt: input.excerpt,
    tickers: input.tickers,
  };
}

export function buildSocialCopy(input: SocialCopyInput): SocialCopyBundle {
  if (input.type === "post") {
    const path = `/${input.kind === "analysis" ? "analysis" : "news"}/${input.slug}`;
    const campaign = slugifyCampaign(`${input.kind}_${input.slug}`);
    const xUrl = xUrlForPost(path, campaign);
    const xhsUrl = withUtm(path, { source: "xhs", campaign });
    const bundle = buildShareBundle(postShareInput(input), xhsUrl);
    return {
      title: input.title,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy: buildXCopy(input, xUrl),
      xhsCopy: bundle.xiaohongshuText,
      utmCampaign: campaign,
    };
  }

  if (input.type === "rating_change") {
    const { change } = input;
    const path = `/t/${change.symbol}`;
    const campaign = slugifyCampaign(`rating_${change.symbol}`);
    const xUrl = xUrlForPost(path, campaign);
    const xhsUrl = withUtm(path, { source: "xhs", campaign });
    const xhsCopy = `${change.symbol} 评级变动 · ${change.label}\n${change.from_value ?? "—"} → ${change.to_value ?? "—"}\n\n${xhsUrl}\n\n#${change.symbol} #投研 #OPS Alpha #半导体`;
    return {
      title: `${change.symbol} 评级变动`,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy: buildXCopy(input, xUrl),
      xhsCopy,
      utmCampaign: campaign,
    };
  }

  if (input.type === "value_chain") {
    const { layer } = input;
    const campaign = slugifyCampaign(`value_chain_${layer.id}`);
    const xUrl = withUtm("/#value-chain", { source: "x", campaign });
    const xhsUrl = withUtm("/#value-chain", { source: "xhs", campaign });
    const reps = layer.representatives
      .slice(0, 4)
      .map((r) => (r.symbol ? `${r.name} (${r.symbol})` : r.name))
      .join(" · ");
    const xhsCopy = `AI 产业六层价值链 · ${layer.id} ${layer.nameZh}\n${layer.roleZh}\n\n代表：${reps}\n\n${layer.trend2026.slice(0, 180)}…\n\n完整框架 👉 ${xhsUrl}\n\n#AI投资 #半导体 #价值链 #OPS Alpha #${layer.id}`;
    return {
      title: `${layer.id} · ${layer.nameZh}`,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy: buildXCopy(input, xUrl),
      xhsCopy,
      utmCampaign: campaign,
    };
  }

  const campaign = slugifyCampaign(input.title);
  const xUrl = withUtm(input.path, { source: "x", campaign });
  const xhsUrl = withUtm(input.path, { source: "xhs", campaign });
  const xhsCopy = `${input.title}\n\n${input.excerpt ?? ""}\n\n${xhsUrl}\n\n#OPS Alpha #投研`;
  return {
    title: input.title,
    canonicalUrl: xUrl,
    xUrl,
    xhsUrl,
    xCopy: buildXCopy(input, xUrl),
    xhsCopy,
    utmCampaign: campaign,
  };
}

/** 生成文案并解析 X 短链接（池子/API 使用） */
export async function buildSocialCopyAsync(input: SocialCopyInput): Promise<SocialCopyBundle> {
  const bundle = buildSocialCopy(input);
  const { path, refKey } = pathForInput(input);
  try {
    const short = await getOrCreateShortLink({
      path,
      source: "x",
      campaign: bundle.utmCampaign,
      refKey,
    });
    return {
      ...bundle,
      xUrl: short.url,
      canonicalUrl: short.url,
      xCopy: buildXCopy(input, short.url),
      shortCode: short.code,
    };
  } catch {
    return bundle;
  }
}
