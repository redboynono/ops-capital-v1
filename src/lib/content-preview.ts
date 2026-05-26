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
