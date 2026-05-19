export type TocItem = { id: string; level: 2 | 3; text: string };

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

/** Extract h2/h3 headings from markdown for table of contents. */
export function extractTocFromMarkdown(md: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  for (const line of md.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/\*\*/g, "").trim();
    if (!text) continue;
    let id = slugifyHeading(text);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    items.push({ id, level, text });
  }
  return items;
}

export function shouldShowToc(md: string, minChars = 1500): boolean {
  if (md.length < minChars) return false;
  return extractTocFromMarkdown(md).length >= 2;
}
