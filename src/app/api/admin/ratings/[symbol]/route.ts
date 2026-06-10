import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  CORE_FACTORS,
  DIVIDEND_FACTORS,
  type FactorKey,
  type Grade,
  type RatingInput,
  type Verdict,
  getFactorGrades,
  getRating,
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
const VALID_FACTORS = new Set<FactorKey>([...CORE_FACTORS, ...DIVIDEND_FACTORS]);

type FactorPayload = Partial<Record<FactorKey, { now?: string | null; m3?: string | null; m6?: string | null }>>;

type PutPayload = RatingInput & {
  factors?: FactorPayload;
};

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

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) return NextResponse.json({ error: "ticker not found" }, { status: 404 });

  const [rating, factorsMap] = await Promise.all([getRating(symbol), getFactorGrades(symbol)]);
  const factors: Record<string, { now: Grade | null; m3: Grade | null; m6: Grade | null }> = {};
  for (const f of [...CORE_FACTORS, ...DIVIDEND_FACTORS]) {
    const row = factorsMap.get(f);
    factors[f] = {
      now: row?.grade_now ?? null,
      m3: row?.grade_3m ?? null,
      m6: row?.grade_6m ?? null,
    };
  }

  return NextResponse.json({ ticker, rating, factors });
}

export async function PUT(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) return NextResponse.json({ error: "ticker not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as PutPayload | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const ratingInput: RatingInput = {
    ops_verdict: safeVerdict(body.ops_verdict),
    ops_score: safeNum(body.ops_score),
    ops_target_price: safeNum(body.ops_target_price),
    street_verdict: safeVerdict(body.street_verdict),
    street_score: safeNum(body.street_score),
    street_target_price: safeNum(body.street_target_price),
    street_analyst_count: safeNum(body.street_analyst_count),
    quant_score: safeNum(body.quant_score),
    rank_overall: safeNum(body.rank_overall),
    rank_overall_total: safeNum(body.rank_overall_total),
    rank_sector: safeNum(body.rank_sector),
    rank_sector_total: safeNum(body.rank_sector_total),
    rank_industry: safeNum(body.rank_industry),
    rank_industry_total: safeNum(body.rank_industry_total),
    industry: typeof body.industry === "string" ? body.industry : null,
    has_dividend: !!body.has_dividend,
    notes: typeof body.notes === "string" ? body.notes : null,
    source: body.source ?? "MANUAL",
  };

  await upsertRating(symbol, ratingInput);

  if (body.factors && typeof body.factors === "object") {
    const cleaned: Partial<Record<FactorKey, { now?: Grade | null; m3?: Grade | null; m6?: Grade | null }>> = {};
    for (const [key, v] of Object.entries(body.factors)) {
      if (!VALID_FACTORS.has(key as FactorKey) || !v) continue;
      cleaned[key as FactorKey] = {
        now: safeGrade(v.now),
        m3: safeGrade(v.m3),
        m6: safeGrade(v.m6),
      };
    }
    await upsertFactorGrades(symbol, cleaned);
  }

  // auto recompute quant_score if user did not override
  if (body.quant_score == null || body.quant_score === undefined) {
    await recomputeAndStoreQuantScore(symbol);
  }

  const fresh = await getRating(symbol);
  return NextResponse.json({ ok: true, rating: fresh });
}
