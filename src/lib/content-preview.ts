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
