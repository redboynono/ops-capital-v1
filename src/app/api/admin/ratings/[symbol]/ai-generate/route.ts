import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getTickerBySymbol } from "@/lib/tickers";
import { generateAndSaveRating } from "@/lib/ai/generateRating";
import { generateAndSaveCryptoRating } from "@/lib/crypto/scoreFactors";
import { getAssetClass } from "@/lib/ratings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) return NextResponse.json({ error: "ticker not found" }, { status: 404 });

  try {
    const assetClass = await getAssetClass(symbol);
    if (assetClass === "crypto") {
      const result = await generateAndSaveCryptoRating(symbol, "AI");
      return NextResponse.json({
        ok: true,
        symbol: result.symbol,
        quant_score: result.quant_score,
        verdict: result.verdict,
        factors_now: result.grades,
      });
    }
    const result = await generateAndSaveRating(symbol, {
      name: ticker.name,
      sector: ticker.sector,
    }, "AI");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "ai generation failed", detail: msg }, { status: 502 });
  }
}
