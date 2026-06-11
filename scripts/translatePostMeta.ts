import { callModel } from "@/lib/ai/_runtime";

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function parseTranslation(raw: string, title: string, excerpt: string) {
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  const parsed = JSON.parse(json) as { title?: string; excerpt?: string };
  return {
    titleEn: parsed.title?.trim() || title,
    excerptEn: parsed.excerpt?.trim() || excerpt,
  };
}

async function callTranslate(title: string, excerpt: string, strict: boolean) {
  const system = strict
    ? "Financial editor. Reply with JSON only. All text must be English (Latin script). Ticker symbols may remain."
    : "Translate financial research title and summary to concise English. Reply JSON only.";
  const user = strict
    ? `Fully translate to English — no Chinese characters.\n{"title":"...","excerpt":"..."}\n\nTitle: ${title}\nSummary: ${excerpt.slice(0, 500)}`
    : `{"title":"...","excerpt":"..."}\n\nTitle: ${title}\nSummary: ${excerpt.slice(0, 500)}`;
  return callModel(system, user, { temperature: 0.1, maxTokens: 1024 });
}

export async function translateTitleExcerpt(
  title: string,
  excerpt: string,
): Promise<{ titleEn: string; excerptEn: string }> {
  try {
    let raw = await callTranslate(title, excerpt, false);
    if (!raw) return { titleEn: title, excerptEn: excerpt };
    let out = parseTranslation(raw, title, excerpt);
    if (hasCjk(out.titleEn) || hasCjk(out.excerptEn)) {
      raw = await callTranslate(title, excerpt, true);
      if (raw) out = parseTranslation(raw, title, excerpt);
    }
    return out;
  } catch {
    return { titleEn: title, excerptEn: excerpt };
  }
}
