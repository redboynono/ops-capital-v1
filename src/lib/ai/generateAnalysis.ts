import { randomUUID } from "node:crypto";
import { callModel } from "@/lib/ai/_runtime";
import { researchSystemPrompt, buildResearchUserPrompt } from "@/lib/ai/researchSystemPrompt";
import { buildBaseTickerContext } from "@/lib/agents/context-builders";
import { mysqlQuery } from "@/lib/mysql";
import { setPostTickers } from "@/lib/tickers";

export async function generateAndSaveAnalysis(symbol: string): Promise<string> {
  const context = await buildBaseTickerContext(symbol);
  const userPrompt = buildResearchUserPrompt(symbol, `以下是该标的最新 Factsheet 数据，请严格基于此数据进行分析：\n\n${context}`);

  const content = await callModel(researchSystemPrompt, userPrompt);
  if (!content) throw new Error("Failed to generate analysis content");

  // Extract title from the first line if it starts with #
  let title = `${symbol} 深度研报`;
  let cleanContent = content;
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    title = match[1].trim();
    // Optionally remove the title from content to avoid duplication, but usually it's fine to keep it
  }

  const slug = `${symbol.toLowerCase()}-research-${new Date().toISOString().slice(0, 10)}`;
  const excerpt = content.slice(0, 200).replace(/#/g, "").replace(/\n/g, " ").trim() + "...";
  const id = randomUUID();

  // Save to posts table
  await mysqlQuery(
    `insert into posts (id, slug, title, excerpt, content, kind, is_premium, is_published, created_at, updated_at)
     values (?, ?, ?, ?, ?, 'analysis', false, true, now(), now())
     on duplicate key update title = values(title), excerpt = values(excerpt), content = values(content), updated_at = now()`,
    [id, slug, title, excerpt, cleanContent]
  );

  await setPostTickers(id, [symbol]);

  return slug;
}
