import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/finnhub";
import { mysqlQuery } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickers/lookup?q=CRCL
 *
 * Live ticker search backed by Finnhub. Used by the index page to
 * suggest "未收录但实际存在" matches when our internal DB returns 0
 * results. Each hit is annotated with `inDb: boolean` so the client
 * can either deep-link to the existing /t/SYMBOL page or to a
 * fallback (live) preview.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json({ q, hits: [] });
  }

  const hits = await searchSymbols(q, 8);
  if (hits.length === 0) {
    return NextResponse.json({ q, hits: [] });
  }

  const symbols = hits.map((h) => h.symbol);
  const known = new Set<string>();
  if (symbols.length > 0) {
    const placeholders = symbols.map(() => "?").join(",");
    const rows = await mysqlQuery<{ symbol: string }[]>(
      `select symbol from tickers where symbol in (${placeholders})`,
      symbols,
    );
    for (const r of rows) known.add(r.symbol);
  }

  return NextResponse.json({
    q,
    hits: hits.map((h) => ({
      symbol: h.symbol,
      displaySymbol: h.displaySymbol,
      name: h.description,
      type: h.type,
      inDb: known.has(h.symbol),
    })),
  });
}
