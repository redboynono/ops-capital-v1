import { NextResponse } from "next/server";
import { searchMarketSymbols } from "@/lib/market-symbol-search";
import { mysqlQuery } from "@/lib/mysql";
import { symbolLookupCandidates } from "@/lib/symbol-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tickers/lookup?q=CRCL
 *
 * Live ticker search: Finnhub + Yahoo. Used when the internal index has no match.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json({ q, hits: [] });
  }

  const hits = await searchMarketSymbols(q, 10);
  if (hits.length === 0) {
    return NextResponse.json({ q, hits: [] });
  }

  const known = new Set<string>();
  const allCandidates = hits.flatMap((h) => symbolLookupCandidates(h.symbol));
  const unique = [...new Set(allCandidates)];
  if (unique.length > 0) {
    const placeholders = unique.map(() => "?").join(",");
    const rows = await mysqlQuery<{ symbol: string }[]>(
      `select symbol from tickers where symbol in (${placeholders})`,
      unique,
    );
    for (const r of rows) known.add(r.symbol);
  }

  return NextResponse.json({
    q,
    hits: hits.map((h) => ({
      symbol: h.symbol,
      displaySymbol: h.displaySymbol,
      name: h.name,
      type: h.type,
      exchange: h.exchange,
      inDb: symbolLookupCandidates(h.symbol).some((c) => known.has(c)),
    })),
  });
}
