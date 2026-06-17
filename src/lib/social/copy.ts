import { buildShareBundle, type ShareInput } from "@/lib/share/payload";
import { findLayerForSymbol, type ValueChainLayer } from "@/lib/marketing/ai-value-chain";
import type { RatingChange } from "@/lib/rating-changes";
import { X_CHAR_LIMIT } from "@/lib/social/constants";
import { getOrCreateShortLink } from "@/lib/social/short-link";
import { withUtm, slugifyCampaign } from "@/lib/social/utm";
import type { Locale } from "@/lib/i18n/locale-types";

export { X_CHAR_LIMIT, X_PREMIUM_TARGET } from "@/lib/social/constants";

const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "LINK"]);

const RESEARCH_SECTIONS = [
  "Macro & liquidity mapping",
  "Fundamentals & competitive moat",
  "Catalysts & valuation framework",
  "Tail risks & position sizing",
];

const RESEARCH_SECTIONS_ZH = [
  "宏观与流动性",
  "基本面与护城河",
  "催化剂与估值框架",
  "尾部风险与仓位管理",
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

/** 长文摘要：默认英文优先（最多 5 句 / 520 字）；locale="zh" 时强制用中文摘要（3 句 / 280 字） */
export function extractCoreSummary(
  excerpt?: string,
  excerptEn?: string | null,
  locale?: Locale,
): string {
  const useEn = locale === "zh" ? false : !!excerptEn?.trim();
  const rawSource = locale === "zh" ? excerpt : excerptEn?.trim() || excerpt;
  const raw = (rawSource || "").replace(/^BLUF:\s*/i, "").trim().replace(/\s+/g, " ");
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

function buildXCopy(input: SocialCopyInput, xUrl: string, locale: Locale = "en"): string {
  if (input.type === "post" && locale === "zh") {
    const ticker = input.tickers?.[0];
    const titleZh = input.title;
    const thesisZh = extractCoreSummary(input.excerpt, input.excerpt_en, "zh");

    if (input.kind === "news") {
      const lines = [
        "⚡ 市场快讯 · OPS Alpha",
        ticker ? `$${ticker} · ${titleZh}` : titleZh,
        thesisZh ? `背景\n${thesisZh}` : undefined,
        "全文见下方链接。",
      ].filter((l): l is string => !!l);
      return buildPremiumXCopy({
        lines,
        url: xUrl,
        tickers: input.tickers,
        extraTags: ["#快讯"],
      });
    }

    const lines = [
      "🔬 深度研报 · OPS Alpha",
      ticker ? `$${ticker} · ${titleZh}` : titleZh,
      thesisZh ? `核心观点\n${thesisZh}` : "最新机构级深度研报已上线。",
      `框架\n${RESEARCH_SECTIONS_ZH.map((s) => `· ${s}`).join("\n")}`,
      "完整中文摘要见链接 · 估值模型与风险图需 Research Pro。",
    ];
    return buildPremiumXCopy({
      lines,
      url: xUrl,
      tickers: input.tickers,
      extraTags: ["#深度研报", "#投研"],
    });
  }

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
      `Framework\n${RESEARCH_SECTIONS.map((s) => `· ${s}`).join("\n")}`,
      "Full English summary on site · valuation model & risk map with Research Pro.",
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

export type LocalizedXPost = { locale: Locale; xCopy: string; xUrl: string };

/**
 * 深度研报/快讯：生成中英两条 X 文案，分别带 lang=en / lang=zh 的独立短链，
 * 落地各自指向网站英文版 / 中文版。
 */
export async function buildAnalysisXVariants(
  input: Extract<SocialCopyInput, { type: "post" }>,
): Promise<LocalizedXPost[]> {
  const path = `/${input.kind === "analysis" ? "analysis" : "news"}/${input.slug}`;
  const campaign = slugifyCampaign(`${input.kind}_${input.slug}`);
  const refKey = input.slug;
  const variants: LocalizedXPost[] = [];
  for (const locale of ["en", "zh"] as const) {
    let url = withUtm(path, { source: "x", campaign, lang: locale });
    try {
      const short = await getOrCreateShortLink({ path, source: "x", campaign, refKey, lang: locale });
      url = short.url;
    } catch {
      // 短链失败则回退完整带 lang 的 URL
    }
    variants.push({ locale, xCopy: buildXCopy(input, url, locale), xUrl: url });
  }
  return variants;
}

// ============================== 叙事 thread（六层框架钩子） ============================== //

export type XThread = { locale: Locale; tweets: string[]; xUrl: string };

/** 单条裁剪到 X 上限 */
function tweet(s: string): string {
  return truncateX(s.replace(/\n{3,}/g, "\n\n").trim(), X_CHAR_LIMIT);
}

/**
 * 把一篇深度/卡点研报拆成叙事 thread：
 *  1) 钩子：六层价值链定位 + 标的 + 标题（卡点报告用「supply-chain chokepoint」框架）
 *  2) 核心论点（thesis 摘要）
 *  3) OPS 四段研究框架 + 付费墙钩子
 *  4) 链接 + 标签
 */
function buildAnalysisThread(
  input: Extract<SocialCopyInput, { type: "post" }>,
  url: string,
  locale: Locale,
): string[] {
  const en = locale !== "zh";
  const ticker = input.tickers?.[0];
  const isChoke = input.slug.startsWith("chokepoint-");
  const layer = ticker ? findLayerForSymbol(ticker) : null;
  const title = en ? pickEn(input.title, input.title_en) : input.title;
  const thesis = extractCoreSummary(input.excerpt, input.excerpt_en, locale);
  const tk = ticker ? `$${ticker}` : "";

  // ---- Tweet 1: 钩子 ----
  let hook: string;
  if (layer) {
    hook = en
      ? `🧱 AI value chain · ${layer.id} — ${layer.nameEn}\nThe ${layer.roleEn.toLowerCase()} layer the whole buildout flows through.\n\n${tk} ${title}`
      : `🧱 AI 价值链 · ${layer.id} ${layer.nameZh}\n整条 AI 扩张必经的「${layer.roleZh}」。\n\n${tk} ${title}`;
  } else if (isChoke) {
    hook = en
      ? `🔎 AI supply-chain chokepoint\nThe structural bottleneck hyperscalers can't route around—before it hits the headline names.\n\n${tk} ${title}`
      : `🔎 AI 供应链卡点\n大厂算力扩张绕不开的结构性瓶颈——发生在 headline 名字之前。\n\n${tk} ${title}`;
  } else {
    hook = en ? `🔬 OPS deep research\n\n${tk} ${title}` : `🔬 OPS 深度研报\n\n${tk} ${title}`;
  }

  // ---- Tweet 2: 核心论点 ----
  const thesisTweet = thesis
    ? en
      ? `Thesis 🧵\n${thesis}`
      : `核心观点 🧵\n${thesis}`
    : "";

  // ---- Tweet 3: 框架 + 付费墙钩子 ----
  const frameworkTweet = isChoke
    ? en
      ? `Framework we use:\n${RESEARCH_SECTIONS.map((s) => `· ${s}`).join("\n")}\n\nFull chokepoint map → Chokepoint Brief from $2.99/mo, or Research Pro for all deep dives.`
      : `我们的拆解框架：\n${RESEARCH_SECTIONS_ZH.map((s) => `· ${s}`).join("\n")}\n\n完整卡点逻辑 → Chokepoint Brief $2.99/月起，或 Research Pro 解锁全部深度。`
    : en
      ? `How we frame it:\n${RESEARCH_SECTIONS.map((s) => `· ${s}`).join("\n")}\n\nFull thesis, target price & risk map → Research Pro.`
      : `我们的拆解框架：\n${RESEARCH_SECTIONS_ZH.map((s) => `· ${s}`).join("\n")}\n\n完整逻辑、目标价与风险图 → Research Pro。`;

  // ---- Tweet 4: 链接 + 标签 ----
  const tags = xHashtags(input.tickers, isChoke ? ["#SupplyChain", "#Chokepoint"] : ["#ValueChain"]);
  const linkTweet = en
    ? `Read the full breakdown ↓\n${url}\n\n${tags}`
    : `完整研报 ↓\n${url}\n\n${tags}`;

  const disclaimerTweet = en
    ? `Not investment advice · not a buy/sell call · DYOR.\nVerifiable OPS ratings track record on site.`
    : `非投资建议 · 非喊单 · 请独立判断。\n站内可验证 OPS 评级战绩。`;

  return [hook, thesisTweet, frameworkTweet, linkTweet, disclaimerTweet].filter(Boolean).map(tweet);
}

/**
 * 深度/卡点研报：生成中英两条 thread（各自短链落地对应语种）。
 */
export async function buildAnalysisThreadVariants(
  input: Extract<SocialCopyInput, { type: "post" }>,
): Promise<XThread[]> {
  const path = `/${input.kind === "analysis" ? "analysis" : "news"}/${input.slug}`;
  const campaign = slugifyCampaign(`${input.kind}_${input.slug}`);
  const refKey = input.slug;
  const out: XThread[] = [];
  for (const locale of ["en", "zh"] as const) {
    let url = withUtm(path, { source: "x", campaign, lang: locale });
    try {
      const short = await getOrCreateShortLink({ path, source: "x", campaign, refKey, lang: locale });
      url = short.url;
    } catch {
      // 短链失败回退完整 URL
    }
    out.push({ locale, tweets: buildAnalysisThread(input, url, locale), xUrl: url });
  }
  return out;
}

// ============================== 战绩应验贴 ============================== //

export type TrackRecordCallLite = {
  symbol: string;
  verdict: string;
  since: string;
  returnPct: number | null;
  spyPct: number | null;
  excessPct: number | null;
};

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/**
 * 「战绩应验」thread：用真实的「评级以来 vs SPY 超额」数据做社会证明。
 * 不喊单、不晒杠杆，只陈述已验证的历史判断。
 */
export function buildTrackRecordThread(opts: {
  top: TrackRecordCallLite[];
  buyCount: number;
  winRate: number | null;
  avgExcess: number | null;
  url: string;
  locale: Locale;
}): string[] {
  const en = opts.locale !== "zh";
  const top = opts.top.slice(0, 3);
  if (top.length === 0) return [];

  const head = en
    ? `📒 OPS ratings — receipts, not hype 🧵\n\nAcross ${opts.buyCount} BUY calls: ${fmtPct(opts.winRate)} beat SPY, avg excess ${fmtPct(opts.avgExcess)} since rating.`
    : `📒 OPS 评级战绩 · 用数据说话 🧵\n\n${opts.buyCount} 个买入评级中：${fmtPct(opts.winRate)} 跑赢 SPY，评级以来平均超额 ${fmtPct(opts.avgExcess)}。`;

  const callTweets = top.map((c) =>
    en
      ? `${`$${c.symbol}`} · rated ${c.verdict.replace("_", " ")} since ${c.since}\nReturn ${fmtPct(c.returnPct)} vs SPY ${fmtPct(c.spyPct)} → excess ${fmtPct(c.excessPct)}.`
      : `${`$${c.symbol}`} · ${c.since} 起评 ${c.verdict.replace("_", " ")}\n收益 ${fmtPct(c.returnPct)}，同期 SPY ${fmtPct(c.spyPct)} → 超额 ${fmtPct(c.excessPct)}。`,
  );

  const tail = en
    ? `Track record updates live on the terminal. Not investment advice.\n${opts.url}\n\n#AI #Semiconductors #FinTwit #OPSAlpha`
    : `战绩在终端实时更新，非投资建议。\n${opts.url}\n\n#AI #半导体 #投研 #OPSAlpha`;

  return [head, ...callTweets, tail].filter(Boolean).map(tweet);
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
