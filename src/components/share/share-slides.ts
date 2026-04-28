/**
 * 分享海报内容切片：把一篇文章 / 一个 Pick 切成多张 1080×1440 海报。
 * 纯逻辑，无 JSX，便于单测。
 */

export type PostPoster = {
  type: "post";
  kind: "analysis" | "news";
  title: string;
  excerpt?: string | null;
  content?: string | null; // markdown
  tickers?: string[];
  createdAt?: string;
  url: string;
};

export type PickPoster = {
  type: "pick";
  symbol: string;
  title: string;
  subtitle?: string | null;
  conviction?: "high" | "medium" | "low";
  status: "open" | "closed" | "stopped";
  unrealizedPct?: number | null;
  realizedPct?: number | null;
  entryPrice: number;
  entryDate: string;
  targetPrice?: number | null;
  stopPrice?: number | null;
  currentPrice?: number | null;
  /** 完整 thesis_md，可选 */
  thesisMd?: string | null;
  /** 催化剂 markdown，可选 */
  catalystsMd?: string | null;
  /** 风险 markdown，可选 */
  risksMd?: string | null;
  url: string;
};

export type PosterData = PostPoster | PickPoster;

/** 一张幻灯片的语义类型 */
export type Slide =
  | {
      kind: "post-cover";
      brand: string;
      kindLabel: string; // 深度研报 / 市场快讯
      tickers: string[];
      title: string;
      meta: string; // 日期
    }
  | {
      kind: "pick-cover";
      brand: string;
      symbol: string;
      title: string;
      subtitle?: string;
      convictionLabel: string;
      statusLabel: string;
    }
  | {
      kind: "bluf";
      brand: string;
      title: string;
      bluf: string;
      tickers: string[];
    }
  | {
      kind: "stats";
      brand: string;
      symbol: string;
      pct: number | null | undefined;
      pctLabel: string;
      entry: number;
      current: number | null | undefined;
      target: number | null | undefined;
      stop: number | null | undefined;
      entryDate: string;
    }
  | {
      kind: "body";
      brand: string;
      sectionLabel: string; // e.g. "正文"
      heading?: string;
      paragraphs: string[];
      pageNum: number;
      pageTotal: number;
    }
  | {
      kind: "cta";
      brand: string;
      url: string;
    };

const BRAND = "OPS ALPHA TERMINAL";
const PARAGRAPHS_PER_BODY_SLIDE = 2;
const MAX_BODY_SLIDES = 6;
const MAX_PARAGRAPH_CHARS = 280; // 单段最多字数（超出截断加 …）
const MAX_BLUF_CHARS = 320;

/**
 * 把一段 markdown 切成 [{heading?, paragraphs[]}] 的小节数组。
 * - 优先按 `## ` / `### ` 等 heading 切
 * - 每个 section 内部再按 `\n\n` 切段
 */
export function splitMarkdownSections(
  md: string,
): { heading?: string; paragraphs: string[] }[] {
  if (!md?.trim()) return [];
  const sections: { heading?: string; paragraphs: string[] }[] = [];
  // 用换行 + ##... 作为分隔
  const parts = md.split(/\n(?=##+\s+)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^(##+)\s+(.+)/);
    let heading: string | undefined;
    let body = trimmed;
    if (headingMatch) {
      heading = headingMatch[2].trim();
      body = trimmed.slice(headingMatch[0].length).trim();
    }
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) =>
        // 把行内 markdown 简化：去 **bold**、*italic*、`code`、列表前缀；保留原文可读
        p
          .replace(/^[-*+]\s+/gm, "· ")
          .replace(/^\d+\.\s+/gm, (m) => m) // 保留编号
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/\n+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .map((p) => (p.length > MAX_PARAGRAPH_CHARS ? p.slice(0, MAX_PARAGRAPH_CHARS) + "…" : p));
    if (paragraphs.length || heading) sections.push({ heading, paragraphs });
  }
  return sections;
}

/** 把切完的 sections 分页：每页最多 N 段，超长 section 拆多页 */
function paginateSections(
  sections: { heading?: string; paragraphs: string[] }[],
  perPage = PARAGRAPHS_PER_BODY_SLIDE,
): { heading?: string; paragraphs: string[] }[] {
  const pages: { heading?: string; paragraphs: string[] }[] = [];
  for (const sec of sections) {
    if (sec.paragraphs.length === 0) {
      if (sec.heading) pages.push({ heading: sec.heading, paragraphs: [] });
      continue;
    }
    for (let i = 0; i < sec.paragraphs.length; i += perPage) {
      const chunk = sec.paragraphs.slice(i, i + perPage);
      pages.push({
        heading: i === 0 ? sec.heading : undefined,
        paragraphs: chunk,
      });
    }
  }
  return pages;
}

function clampBluf(s: string): string {
  const t = s.trim();
  return t.length > MAX_BLUF_CHARS ? t.slice(0, MAX_BLUF_CHARS) + "…" : t;
}

export function buildSlides(data: PosterData): Slide[] {
  return data.type === "post" ? buildPostSlides(data) : buildPickSlides(data);
}

function buildPostSlides(data: PostPoster): Slide[] {
  const slides: Slide[] = [];
  const kindLabel = data.kind === "analysis" ? "深度研报" : "市场快讯";
  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "";

  // 1. Cover
  slides.push({
    kind: "post-cover",
    brand: BRAND,
    kindLabel,
    tickers: data.tickers ?? [],
    title: data.title,
    meta: dateStr,
  });

  // 2. BLUF（如果有 excerpt）
  if (data.excerpt && data.excerpt.trim()) {
    slides.push({
      kind: "bluf",
      brand: BRAND,
      title: data.title,
      bluf: clampBluf(data.excerpt),
      tickers: data.tickers ?? [],
    });
  }

  // 3..N. Body
  if (data.content && data.content.trim()) {
    const sections = splitMarkdownSections(data.content);
    const pages = paginateSections(sections).slice(0, MAX_BODY_SLIDES);
    pages.forEach((p, idx) => {
      slides.push({
        kind: "body",
        brand: BRAND,
        sectionLabel: kindLabel,
        heading: p.heading,
        paragraphs: p.paragraphs,
        pageNum: idx + 1,
        pageTotal: pages.length,
      });
    });
  }

  // Final. CTA
  slides.push({ kind: "cta", brand: BRAND, url: data.url });
  return slides;
}

function buildPickSlides(data: PickPoster): Slide[] {
  const slides: Slide[] = [];
  const convictionLabel =
    data.conviction === "high" ? "高信念" : data.conviction === "low" ? "低信念" : "中等信念";
  const statusLabel =
    data.status === "open" ? "开仓中" : data.status === "stopped" ? "已止损" : "已平仓";

  // 1. Cover
  slides.push({
    kind: "pick-cover",
    brand: BRAND,
    symbol: data.symbol,
    title: data.title,
    subtitle: data.subtitle ?? undefined,
    convictionLabel,
    statusLabel,
  });

  // 2. Stats（4 格价格 + 大收益率）
  slides.push({
    kind: "stats",
    brand: BRAND,
    symbol: data.symbol,
    pct: data.status === "open" ? data.unrealizedPct : data.realizedPct,
    pctLabel: data.status === "open" ? "浮动收益" : "实现收益",
    entry: data.entryPrice,
    current: data.currentPrice,
    target: data.targetPrice,
    stop: data.stopPrice,
    entryDate: data.entryDate,
  });

  // 3. BLUF（用 subtitle 作为 BLUF）
  if (data.subtitle && data.subtitle.trim()) {
    slides.push({
      kind: "bluf",
      brand: BRAND,
      title: data.title,
      bluf: clampBluf(data.subtitle),
      tickers: [data.symbol],
    });
  }

  // 4..N. Body（thesis / catalysts / risks）
  const bodySource = [
    data.thesisMd ? `## 投资逻辑\n\n${data.thesisMd}` : "",
    data.catalystsMd ? `## 催化剂\n\n${data.catalystsMd}` : "",
    data.risksMd ? `## 风险\n\n${data.risksMd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  if (bodySource) {
    const sections = splitMarkdownSections(bodySource);
    const pages = paginateSections(sections).slice(0, MAX_BODY_SLIDES);
    pages.forEach((p, idx) => {
      slides.push({
        kind: "body",
        brand: BRAND,
        sectionLabel: "OPS PICKS",
        heading: p.heading,
        paragraphs: p.paragraphs,
        pageNum: idx + 1,
        pageTotal: pages.length,
      });
    });
  }

  // Final. CTA
  slides.push({ kind: "cta", brand: BRAND, url: data.url });
  return slides;
}

/** 文件名工具 */
export function slideFileName(slide: Slide, index: number): string {
  const num = String(index + 1).padStart(2, "0");
  switch (slide.kind) {
    case "post-cover":
    case "pick-cover":
      return `${num}_cover.png`;
    case "bluf":
      return `${num}_bluf.png`;
    case "stats":
      return `${num}_stats.png`;
    case "body":
      return `${num}_body_${slide.pageNum}.png`;
    case "cta":
      return `${num}_cta.png`;
  }
}
