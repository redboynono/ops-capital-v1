import { randomUUID } from "node:crypto";
import { mysqlQuery } from "@/lib/mysql";
import {
  fetchBasicFinancials,
  fetchCompanyNews,
} from "@/lib/finnhub";
import { linkEarningsPost, type EarningsRow } from "@/lib/earnings";
import { getRating } from "@/lib/ratings";
import { setPostTickers } from "@/lib/tickers";
import {
  EARNINGS_SYSTEM_PROMPT,
  buildEarningsUserPrompt,
} from "@/lib/ai/earningsArticlePrompt";

export type GeneratedArticle = {
  symbol: string;
  year: number;
  quarter: number;
  post_id: string;
  slug: string;
};

type ArticleJson = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function generateAndSaveEarningsPost(
  er: EarningsRow,
): Promise<GeneratedArticle> {
  const tickerRows = await mysqlQuery<
    { symbol: string; name: string; sector: string | null }[]
  >("select symbol, name, sector from tickers where symbol = ? limit 1", [er.symbol]);
  const ticker = tickerRows[0];
  if (!ticker) throw new Error(`ticker ${er.symbol} not in our table`);

  const newsFrom = new Date(er.report_date);
  newsFrom.setUTCDate(newsFrom.getUTCDate() - 30);
  const newsTo = new Date(er.report_date);
  newsTo.setUTCDate(newsTo.getUTCDate() + 5);

  const [news, fin, rating] = await Promise.all([
    fetchCompanyNews(er.symbol, isoDate(newsFrom), isoDate(newsTo), 8),
    fetchBasicFinancials(er.symbol),
    getRating(er.symbol).catch(() => null),
  ]);

  const userPrompt = buildEarningsUserPrompt({
    symbol: er.symbol,
    name: ticker.name,
    sector: ticker.sector,
    industry: rating?.industry ?? null,
    fiscal_year: er.fiscal_year,
    fiscal_quarter: er.fiscal_quarter,
    report_date: er.report_date,
    hour: er.hour,
    eps_actual: er.eps_actual,
    eps_estimate: er.eps_estimate,
    revenue_actual: er.revenue_actual,
    revenue_estimate: er.revenue_estimate,
    metrics: fin?.metric ?? null,
    news,
    ops_rating: rating
      ? {
          verdict: rating.ops_verdict,
          score: rating.ops_score == null ? null : Number(rating.ops_score),
          target_price:
            rating.ops_target_price == null ? null : Number(rating.ops_target_price),
        }
      : null,
  });

  const raw = await callModel(EARNINGS_SYSTEM_PROMPT, userPrompt);
  const article = parseArticleJson(raw, er);

  const postId = randomUUID();
  await mysqlQuery(
    `insert into posts (id, title, slug, kind, excerpt, content, is_premium, is_published, author_id)
     values (?, ?, ?, 'analysis', ?, ?, 1, 1, null)
     on duplicate key update
       title = values(title),
       excerpt = values(excerpt),
       content = values(content),
       is_published = 1`,
    [postId, article.title, article.slug, article.excerpt, article.content],
  );

  const persisted = await mysqlQuery<{ id: string }[]>(
    "select id from posts where slug = ? limit 1",
    [article.slug],
  );
  const finalPostId = persisted[0]?.id ?? postId;

  await setPostTickers(finalPostId, [er.symbol]);
  await linkEarningsPost(er.id, finalPostId);

  return {
    symbol: er.symbol,
    year: er.fiscal_year,
    quarter: er.fiscal_quarter,
    post_id: finalPostId,
    slug: article.slug,
  };
}

function parseArticleJson(raw: string, er: EarningsRow): ArticleJson {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) {
    throw new Error(`AI output has no JSON object: ${raw.slice(0, 200)}`);
  }
  const parsed = JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;

  const title = String(parsed.title ?? "").trim();
  const slugRaw = String(parsed.slug ?? "").trim().toLowerCase();
  const expectedSlug = `${er.symbol.toLowerCase()}-${er.fiscal_year}q${er.fiscal_quarter}-earnings`;
  const slug = /^[a-z0-9-]+$/.test(slugRaw) ? slugRaw : expectedSlug;
  const excerpt = String(parsed.excerpt ?? "").trim();
  const content = String(parsed.content ?? "").trim();

  if (!title || !content) throw new Error("AI output missing title/content");
  if (content.length < 800) {
    throw new Error(`AI content too short: ${content.length} chars`);
  }

  return { title, slug, excerpt: excerpt || title, content };
}

async function callModel(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";

  const res = await fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: Number(process.env.OPENAI_MAX_TOKENS ?? 16000),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`AI ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }
  const out = data?.choices?.[0]?.message?.content;
  if (!out || typeof out !== "string") throw new Error("AI empty content");
  return out;
}
