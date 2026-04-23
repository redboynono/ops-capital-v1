import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "missing symbols" }, { status: 400 });
  }
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60); // hard cap to protect upstream

  try {
    const quotes = await getQuotes(symbols);
    return NextResponse.json(
      { quotes, ts: Date.now() },
      {
        headers: {
          // Allow browser to re-use for 30s; our server-side cache lives 60s
          "Cache-Control": "public, max-age=30",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "quote fetch failed" },
      { status: 500 },
    );
  }
}
