import { randomUUID } from "node:crypto";
import { callModel } from "@/lib/ai/_runtime";
import { researchSystemPrompt, buildResearchUserPrompt } from "@/lib/ai/researchSystemPrompt";
import { buildBaseTickerContext } from "@/lib/agents/context-builders";
import { mysqlQuery } from "@/lib/mysql";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";
import { getTickerBySymbol, setPostTickers } from "@/lib/tickers";

export async function generateAndSaveAnalysis(symbol: string): Promise<string> {
  const sym = normalizeInternalSymbol(symbol);
  const ticker = await getTickerBySymbol(sym);
  const label = ticker?.name && ticker.name !== sym ? `${ticker.name} (${sym})` : sym;

  const context = await buildBaseTickerContext(sym);
  const userPrompt = buildResearchUserPrompt(
    label,
    `以下是该标的最新 Factsheet 数据，请严格基于此数据进行分析。若报价为 n/a 或缺失，不得编造 $0 价格。\n\n${context}`,
  );

  const content = await callModel(researchSystemPrompt, userPrompt);
  if (!content) throw new Error("Failed to generate analysis content");

  // Extract title from the first line if it starts with #
  let title = `${label} 深度研报`;
  const cleanContent = content;
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    title = match[1].trim();
  }

  const slug = `${sym.toLowerCase()}-research-${new Date().toISOString().slice(0, 10)}`;
  const excerpt = content.slice(0, 200).replace(/#/g, "").replace(/\n/g, " ").trim() + "...";
  const { titleEn, excerptEn } = await translateTitleExcerpt(title, excerpt);
  const id = randomUUID();

  // 默认 Research Pro；公开样例在后台或 daily-content 中单独设置
  await mysqlQuery(
    `insert into posts (id, slug, title, title_en, excerpt, excerpt_en, content, kind, is_premium, is_published, created_at)
     values (?, ?, ?, ?, ?, ?, ?, 'analysis', 1, true, now())
     on duplicate key update title = values(title), title_en = values(title_en),
       excerpt = values(excerpt), excerpt_en = values(excerpt_en), content = values(content)`,
    [id, slug, title, titleEn, excerpt, excerptEn, cleanContent],
  );

  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from posts where slug = ? limit 1",
    [slug],
  );
  const postId = rows[0]?.id ?? id;
  await setPostTickers(postId, [sym]);

  return slug;
}

async function translateTitleExcerpt(
  title: string,
  excerpt: string,
): Promise<{ titleEn: string; excerptEn: string }> {
  const prompt = `Translate the Chinese research title and summary to English. Reply JSON only: {"title":"...","excerpt":"..."}`;
  const raw = await callModel(
    "You translate financial research metadata to concise English.",
    `${prompt}\n\nTitle: ${title}\nSummary: ${excerpt}`,
  );
  if (!raw) return { titleEn: title, excerptEn: excerpt };
  try {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = JSON.parse(json) as { title?: string; excerpt?: string };
    return {
      titleEn: parsed.title?.trim() || title,
      excerptEn: parsed.excerpt?.trim() || excerpt,
    };
  } catch {
    return { titleEn: title, excerptEn: excerpt };
  }
}
