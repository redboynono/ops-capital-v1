import { NextRequest, NextResponse } from "next/server";
import { globalSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return NextResponse.json({ tickers: [], posts: [] });
  }
  const results = await globalSearch(q, 15);
  return NextResponse.json(results);
}
