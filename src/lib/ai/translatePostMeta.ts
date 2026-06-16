import { callModel } from "@/lib/ai/_runtime";

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function parseLines(raw: string, title: string, excerpt: string) {
  const cleaned = raw.replace(/^\s*```[\s\S]*?```\s*/gm, "").trim();
  const titleM = cleaned.match(/^EN_TITLE:\s*(.+)$/im);
  const excerptM = cleaned.match(/EN_EXCERPT:\s*([\s\S]+)$/i);
  if (!titleM || !excerptM) throw new Error("missing EN_TITLE/EN_EXCERPT lines");
  const excerptEn = excerptM[1].replace(/\s+/g, " ").trim().slice(0, 400);
  return {
    titleEn: titleM[1].trim() || title,
    excerptEn: excerptEn || excerpt,
  };
}

async function callTranslate(title: string, excerpt: string, strict: boolean) {
  const system = strict
    ? "Financial editor. Reply with exactly two lines in English only (Latin script). Ticker symbols may remain."
    : "Translate financial research metadata to concise English.";
  const user = `Translate to English. Reply exactly:
EN_TITLE: <english title>
EN_EXCERPT: <english summary, 1-3 sentences>

${strict ? "No Chinese characters allowed.\n\n" : ""}Title: ${title}
Summary: ${excerpt.slice(0, 500)}`;
  return callModel(system, user, { temperature: 0.1, maxTokens: 1024 });
}

const CONTENT_CHUNK = 9000;

function parseMarkdownBody(raw: string, fallback: string): string {
  const cleaned = raw.replace(/^\s*```(?:markdown)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const marker = cleaned.match(/^EN_MARKDOWN:\s*\n?([\s\S]+)$/im);
  const body = (marker?.[1] ?? cleaned).trim();
  if (!body) throw new Error("empty markdown translation");
  return body;
}

async function translateContentChunk(chunk: string, strict: boolean): Promise<string> {
  const system = strict
    ? "Institutional equity research editor. Translate markdown to English only. Preserve headings, lists, tables, numbers, tickers. No Chinese characters."
    : "Translate financial research markdown to English. Preserve markdown structure, numbers, and ticker symbols.";
  const user = `${strict ? "No Chinese characters in output.\n\n" : ""}Translate this markdown section to English. Start output with EN_MARKDOWN: then the translated markdown.

${chunk}`;
  const raw = await callModel(system, user, { temperature: 0.15, maxTokens: 16000 });
  if (!raw) throw new Error("empty content translation");
  return parseMarkdownBody(raw, chunk);
}

export async function translatePostContent(content: string): Promise<string> {
  if (!content.trim()) return content;
  const chunks: string[] = [];
  if (content.length <= CONTENT_CHUNK) {
    chunks.push(content);
  } else {
    const parts = content.split(/(?=^## )/m);
    let buf = "";
    for (const part of parts) {
      if ((buf + part).length > CONTENT_CHUNK && buf) {
        chunks.push(buf);
        buf = part;
      } else {
        buf += part;
      }
    }
    if (buf) chunks.push(buf);
  }

  const out: string[] = [];
  for (const chunk of chunks) {
    let translated = await translateContentChunk(chunk, false);
    if (hasCjk(translated)) {
      translated = await translateContentChunk(chunk, true);
    }
    if (hasCjk(translated)) throw new Error("content translation still contains CJK");
    out.push(translated);
  }
  return out.join("\n\n").trim();
}

export async function translateTitleExcerpt(
  title: string,
  excerpt: string,
): Promise<{ titleEn: string; excerptEn: string }> {
  try {
    let raw = await callTranslate(title, excerpt, false);
    if (!raw) return { titleEn: title, excerptEn: excerpt };
    let out = parseLines(raw, title, excerpt);
    if (hasCjk(out.titleEn) || hasCjk(out.excerptEn)) {
      raw = await callTranslate(title, excerpt, true);
      if (raw) out = parseLines(raw, title, excerpt);
    }
    if (hasCjk(out.titleEn) || hasCjk(out.excerptEn)) {
      throw new Error("translation still contains CJK");
    }
    return out;
  } catch {
    return { titleEn: title, excerptEn: excerpt };
  }
}
