import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { buildRatingsUserPrompt, ratingsSystemPrompt } from "@/lib/ai/ratingsPrompt";
import {
  CORE_FACTORS,
  DIVIDEND_FACTORS,
  type FactorKey,
  type Grade,
  type Verdict,
  recomputeAndStoreQuantScore,
  upsertFactorGrades,
  upsertRating,
} from "@/lib/ratings";
import { getTickerBySymbol } from "@/lib/tickers";

export const dynamic = "force-dynamic";

const VALID_VERDICTS = new Set<Verdict>(["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"]);
const VALID_GRADES = new Set<Grade>([
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F",
]);

function safeVerdict(v: unknown): Verdict | null {
  if (typeof v !== "string") return null;
  return VALID_VERDICTS.has(v as Verdict) ? (v as Verdict) : null;
}
function safeGrade(g: unknown): Grade | null {
  if (typeof g !== "string") return null;
  const up = g.toUpperCase().replace("＋", "+").replace("－", "-");
  return VALID_GRADES.has(up as Grade) ? (up as Grade) : null;
}
function safeNum(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function extractJson(raw: string): unknown {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  // find first { ... } block
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("No JSON object in model output");
  }
  const jsonText = stripped.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonText);
}

async function callModel(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set on server");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const chatPath = process.env.OPENAI_CHAT_PATH ?? "/chat/completions";

  const res = await fetch(`${baseUrl}${chatPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: Number(process.env.OPENAI_MAX_TOKENS ?? 4096),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstream ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data?.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`Upstream err ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty model output");
  return content;
}

export async function POST(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) return NextResponse.json({ error: "ticker not found" }, { status: 404 });

  try {
    const userPrompt = buildRatingsUserPrompt(symbol, ticker.name, ticker.sector ?? undefined);
    const raw = await callModel(ratingsSystemPrompt, userPrompt);
    const parsed = extractJson(raw) as Record<string, unknown>;

    // pull factors
    const factorsRaw = (parsed.factors ?? {}) as Record<string, { now?: unknown; m3?: unknown; m6?: unknown } | null>;
    const factorsClean: Partial<Record<FactorKey, { now: Grade | null; m3: Grade | null; m6: Grade | null }>> = {};
    for (const key of [...CORE_FACTORS, ...DIVIDEND_FACTORS]) {
      const v = factorsRaw[key];
      if (!v) continue;
      factorsClean[key] = {
        now: safeGrade(v.now),
        m3: safeGrade(v.m3),
        m6: safeGrade(v.m6),
      };
    }

    await upsertRating(symbol, {
      ops_verdict: safeVerdict(parsed.ops_verdict),
      ops_score: safeNum(parsed.ops_score),
      ops_target_price: safeNum(parsed.ops_target_price),
      street_verdict: safeVerdict(parsed.street_verdict),
      street_score: safeNum(parsed.street_score),
      street_target_price: safeNum(parsed.street_target_price),
      street_analyst_count: safeNum(parsed.street_analyst_count),
      rank_overall: safeNum(parsed.rank_overall),
      rank_overall_total: safeNum(parsed.rank_overall_total),
      rank_sector: safeNum(parsed.rank_sector),
      rank_sector_total: safeNum(parsed.rank_sector_total),
      rank_industry: safeNum(parsed.rank_industry),
      rank_industry_total: safeNum(parsed.rank_industry_total),
      industry: typeof parsed.industry === "string" ? parsed.industry : null,
      has_dividend: !!parsed.has_dividend,
      notes: typeof parsed.notes === "string" ? parsed.notes : null,
      source: "AI",
    });

    await upsertFactorGrades(symbol, factorsClean);
    // recompute quant_score from factors (override model's quant if any)
    const quant = await recomputeAndStoreQuantScore(symbol);

    return NextResponse.json({ ok: true, symbol, quant_score: quant });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "ai-generate failed", detail }, { status: 502 });
  }
}
