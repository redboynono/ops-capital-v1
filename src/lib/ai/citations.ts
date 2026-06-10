/**
 * Parse inline source citations from AI answers.
 * Format: ...sentence[来源: OPS Rating · 2026-05-19]...
 */

export type ParsedCitation = { index: number; source: string };

const CITE_RE = /\[来源:\s*([^\]]+)\]/g;

export function extractCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  let i = 1;
  for (const m of text.matchAll(CITE_RE)) {
    out.push({ index: i++, source: m[1].trim() });
  }
  return out;
}

/** Split text into segments for rendering (text | citation). */
export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "cite"; source: string; index: number };

export function parseCitationSegments(text: string): CitationSegment[] {
  const segments: CitationSegment[] = [];
  let last = 0;
  let idx = 1;
  CITE_RE.lastIndex = 0;
  for (const m of text.matchAll(CITE_RE)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ type: "text", value: text.slice(last, start) });
    segments.push({ type: "cite", source: m[1].trim(), index: idx++ });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}
