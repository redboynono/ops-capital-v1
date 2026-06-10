import { buildShareBundle, type ShareInput } from "@/lib/share/payload";
import type { ValueChainLayer } from "@/lib/marketing/ai-value-chain";
import type { RatingChange } from "@/lib/rating-changes";
import { X_CHAR_LIMIT } from "@/lib/social/constants";
import { getOrCreateShortLink } from "@/lib/social/short-link";
import { withUtm, slugifyCampaign } from "@/lib/social/utm";

export { X_CHAR_LIMIT } from "@/lib/social/constants";

function xLen(s: string): number {
  return [...s].length;
}

function truncateX(s: string, max: number): string {
  if (xLen(s) <= max) return s;
  return [...s].slice(0, Math.max(0, max - 1)).join("") + "…";
}

/** 文章核心摘要（BLUF 主体，保留中文原意） */
export function extractCoreSummary(excerpt?: string): string {
  if (!excerpt) return "";
  const t = excerpt.replace(/^BLUF:\s*/i, "").trim().replace(/\s+/g, " ");
  const sentences = t.split(/(?<=[。！？!?])\s*/).filter(Boolean);
  const core = (sentences.slice(0, 2).join("") || t).trim();
  return core;
}

function xHashtags(tickers: string[] = [], max = 2): string {
  const tags = [...new Set([...tickers.slice(0, 1).map((t) => `#${t}`), "#AI", "#Semiconductors"])];
  return tags.slice(0, max).join(" ");
}

/** 拼装 X 文案，硬限制在 limit 字符内（含链接与话题） */
function buildShortXCopy(opts: {
  lead: string;
  body?: string;
  url: string;
  tickers?: string[];
  limit?: number;
}): string {
  const limit = opts.limit ?? X_CHAR_LIMIT;
  const tags = xHashtags(opts.tickers);
  const footer = `\n\n${opts.url}\n\n${tags}`;
  const footerLen = xLen(footer);
  let head = opts.lead;
  if (opts.body) head += `\n\n${opts.body}`;

  if (xLen(head + footer) <= limit) return head + footer;

  const bodyBudget = limit - footerLen - xLen(opts.lead) - 2;
  if (opts.body && bodyBudget > 24) {
    head = `${opts.lead}\n\n${truncateX(opts.body, bodyBudget)}`;
    if (xLen(head + footer) <= limit) return head + footer;
  }

  head = truncateX(opts.lead, limit - footerLen - 1);
  return head + footer;
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

function rebuildXCopy(input: SocialCopyInput, xUrl: string): string {
  if (input.type === "post") {
    const ticker = input.tickers?.[0];
    if (input.kind === "news") {
      return buildShortXCopy({
        lead: ticker ? `$${ticker} · OPS Alpha 快讯` : "OPS Alpha 快讯",
        body: extractCoreSummary(input.excerpt) || truncateX(input.title, 100),
        url: xUrl,
        tickers: input.tickers,
      });
    }
    return buildShortXCopy({
      lead: ticker
        ? `$${ticker} · ${truncateX(input.title, 42)}`
        : truncateX(input.title, 56),
      body: extractCoreSummary(input.excerpt) || "深度研报已发布，详见链接。",
      url: xUrl,
      tickers: input.tickers,
    });
  }
  if (input.type === "rating_change") {
    const { change } = input;
    return buildShortXCopy({
      lead: `$${change.symbol} 评级变动`,
      body: `${change.label}：${change.from_value ?? "—"} → ${change.to_value ?? "—"}`,
      url: xUrl,
      tickers: [change.symbol],
    });
  }
  if (input.type === "value_chain") {
    const reps = input.layer.representatives
      .slice(0, 3)
      .map((r) => (r.symbol ? r.symbol : r.name))
      .join(" · ");
    return buildShortXCopy({
      lead: `AI 价值链 ${input.layer.id} · ${input.layer.nameZh}`,
      body: truncateX(input.layer.trend2026, 100) || `代表：${reps}`,
      url: xUrl,
      tickers: input.layer.representatives.map((r) => r.symbol).filter(Boolean) as string[],
    });
  }
  return buildShortXCopy({
    lead: truncateX(input.title, 80),
    body: input.excerpt ? extractCoreSummary(input.excerpt) || truncateX(input.excerpt, 100) : undefined,
    url: xUrl,
  });
}

export type SocialCopyInput =
  | {
      type: "post";
      kind: "analysis" | "news";
      title: string;
      slug: string;
      excerpt?: string;
      tickers?: string[];
    }
  | { type: "rating_change"; change: RatingChange }
  | { type: "value_chain"; layer: ValueChainLayer }
  | { type: "custom"; title: string; path: string; excerpt?: string };

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
    const ticker = input.tickers?.[0];
    const xCopy =
      input.kind === "news"
        ? buildShortXCopy({
            lead: ticker ? `$${ticker} · OPS Alpha flash` : "OPS Alpha market flash",
            body: truncateX(input.title.replace(/\s+/g, " "), 90),
            url: xUrl,
            tickers: input.tickers,
          })
        : buildShortXCopy({
            lead: ticker
              ? `$${ticker} · ${truncateX(input.title, 42)}`
              : truncateX(input.title, 56),
            body: extractCoreSummary(input.excerpt) || "深度研报已发布，详见链接。",
            url: xUrl,
            tickers: input.tickers,
          });
    return {
      title: input.title,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy,
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
    const xCopy = buildShortXCopy({
      lead: `$${change.symbol} rating: ${change.from_value ?? "—"} → ${change.to_value ?? "—"}`,
      body: change.label,
      url: xUrl,
      tickers: [change.symbol],
    });
    const xhsCopy = `${change.symbol} 评级变动 · ${change.label}\n${change.from_value ?? "—"} → ${change.to_value ?? "—"}\n\n${xhsUrl}\n\n#${change.symbol} #投研 #OPS Alpha #半导体`;
    return {
      title: `${change.symbol} 评级变动`,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy,
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
    const xCopy = buildShortXCopy({
      lead: `AI Value Chain ${layer.id}`,
      body: truncateX(`Key: ${reps}`, 80),
      url: xUrl,
      tickers: layer.representatives.map((r) => r.symbol).filter(Boolean) as string[],
    });
    const xhsCopy = `AI 产业六层价值链 · ${layer.id} ${layer.nameZh}\n${layer.roleZh}\n\n代表：${reps}\n\n${layer.trend2026.slice(0, 180)}…\n\n完整框架 👉 ${xhsUrl}\n\n#AI投资 #半导体 #价值链 #OPS Alpha #${layer.id}`;
    return {
      title: `${layer.id} · ${layer.nameZh}`,
      canonicalUrl: xUrl,
      xUrl,
      xhsUrl,
      xCopy,
      xhsCopy,
      utmCampaign: campaign,
    };
  }

  const campaign = slugifyCampaign(input.title);
  const xUrl = withUtm(input.path, { source: "x", campaign });
  const xhsUrl = withUtm(input.path, { source: "xhs", campaign });
  const xCopy = buildShortXCopy({
    lead: truncateX(input.title, 100),
    body: input.excerpt ? truncateX(input.excerpt, 80) : undefined,
    url: xUrl,
  });
  const xhsCopy = `${input.title}\n\n${input.excerpt ?? ""}\n\n${xhsUrl}\n\n#OPS Alpha #投研`;
  return {
    title: input.title,
    canonicalUrl: xUrl,
    xUrl,
    xhsUrl,
    xCopy,
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
    const xCopy = rebuildXCopy(input, short.url);
    return {
      ...bundle,
      xUrl: short.url,
      canonicalUrl: short.url,
      xCopy,
      shortCode: short.code,
    };
  } catch {
    return bundle;
  }
}
