import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { generateAndSaveRating } from "@/lib/ai/generateRating";
import { generateAndSaveAnalysis } from "@/lib/ai/generateAnalysis";
import { getTickerBySymbol } from "@/lib/tickers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for LLM generation

export async function POST(req: Request) {
  // We can optionally check a secret token or admin cookie
  // Since this is triggered internally, we might not have the admin cookie if triggered via fetch without forwarding cookies.
  // We'll pass an internal secret or just forward the cookie.
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) {
    return NextResponse.json({ error: "ticker not found in DB" }, { status: 404 });
  }

  try {
    // Generate Rating
    console.log(`[async-generate] Generating AI Rating for ${symbol}...`);
    await generateAndSaveRating(symbol, { name: ticker.name, sector: ticker.sector }, "AI");
    
    // Generate Analysis Post
    console.log(`[async-generate] Generating Analysis Post for ${symbol}...`);
    await generateAndSaveAnalysis(symbol);

    console.log(`[async-generate] Done for ${symbol}.`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[async-generate] Failed for ${symbol}:`, e);
    return NextResponse.json({ error: "generation failed", detail: String(e) }, { status: 500 });
  }
}
