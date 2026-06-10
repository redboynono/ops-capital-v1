/** 研报免费预览：取前几段，避免全文数字打码 */
export function markdownExcerpt(md: string, maxChars = 1400): string {
  const trimmed = md.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const cut = trimmed.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf("\n\n"), cut.lastIndexOf("\n# "));
  const body = lastBreak > 400 ? cut.slice(0, lastBreak) : cut;
  return `${body.trim()}\n\n---\n\n*订阅 Research Pro 阅读全文、估值表与 Ask AI…*`;
}

export function plainTeaser(md: string, maxChars = 280): string {
  const flat = md.replace(/[#>*_`\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= maxChars) return flat;
  return `${flat.slice(0, maxChars).trim()}…`;
}

/** markdown → 可读纯文本字数（中文友好：去语法符号后按字符计） */
export function readableCharCount(md: string): number {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|/g, " ")
    .replace(/[#>*_`\[\]()\-]/g, "")
    .replace(/\s+/g, "")
    .length;
}

export type PaywallSplit = {
  previewMd: string;
  readChars: number;
  totalChars: number;
  readPct: number;   // 1–99
  remainPct: number;
  remainChars: number;
};

/**
 * FT 式付费墙切分：按段落边界取约 ratio 的可读字数作为免费预览，
 * 返回真实的已读/剩余字数统计。最后一段若是标题则丢弃（避免「悬空标题」）。
 */
export function splitForPaywall(md: string, ratio = 0.13): PaywallSplit {
  const trimmed = md.trim();
  const totalChars = readableCharCount(trimmed);
  const target = Math.max(120, Math.floor(totalChars * ratio));

  const blocks = trimmed.split(/\n{2,}/);
  const taken: string[] = [];
  let readChars = 0;
  for (const b of blocks) {
    const n = readableCharCount(b);
    taken.push(b);
    readChars += n;
    if (readChars >= target && taken.length >= 2) break;
  }
  // 去掉结尾的悬空标题 / 分隔线
  while (taken.length > 1 && /^(#{1,6}\s|---\s*$)/.test(taken[taken.length - 1].trim())) {
    readChars -= readableCharCount(taken.pop()!);
  }

  const readPct = Math.min(99, Math.max(1, Math.round((readChars / Math.max(totalChars, 1)) * 100)));
  return {
    previewMd: taken.join("\n\n"),
    readChars,
    totalChars,
    readPct,
    remainPct: 100 - readPct,
    remainChars: Math.max(0, totalChars - readChars),
  };
}

/**
 * 摘要门导语：从正文「第一节」开始预览，避免与已展示的核心结论（excerpt）重复。
 * 若无 H2 小标题则退化为去掉首个 H1 标题后的整体预览。
 */
export function bodyTeaser(md: string, maxChars = 420): string {
  const trimmed = md.trim();
  const firstH2 = trimmed.search(/^##\s+/m);
  const source = firstH2 >= 0 ? trimmed.slice(firstH2) : trimmed.replace(/^#\s+.*$/m, "");
  return plainTeaser(source, maxChars);
}
