import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { generatePickDraft } from "@/lib/ai/generatePick";
import { fetchCompanyProfile } from "@/lib/finnhub";
import { getTickerBySymbol } from "@/lib/tickers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/admin/picks/ai-generate
 *
 * Body: { symbol: "AMD" }
 *
 * Returns a complete editor-ready Pick draft (title, subtitle, 5 markdown
 * sections, entry/target/stop, horizon, conviction, tags). Does NOT save
 * to DB — admin reviews & saves through the existing upsert flow.
 *
 * Falls back to Finnhub /stock/profile2 for ticker name when the symbol
 * isn't in our internal `tickers` table yet (lets admin create picks for
 * fresh IPOs like CRCL even before adding them to the index).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { symbol?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  // Resolve company name + sector. Prefer DB row; fall back to Finnhub profile.
  let name: string | null = null;
  let sector: string | null = null;
  const dbRow = await getTickerBySymbol(symbol);
  if (dbRow) {
    name = dbRow.name;
    sector = dbRow.sector;
  } else {
    const profile = await fetchCompanyProfile(symbol).catch(() => null);
    if (!profile?.name) {
      return NextResponse.json(
        { error: `ticker ${symbol} not found in DB or upstream` },
        { status: 404 },
      );
    }
    name = profile.name;
    sector = profile.finnhubIndustry || null;
  }

  try {
    const draft = await generatePickDraft(symbol, { name: name!, sector });
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "ai generation failed", detail: msg }, { status: 502 });
  }
}
