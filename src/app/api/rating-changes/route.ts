import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listRecentRatingChanges } from "@/lib/rating-changes";
import { mysqlQuery } from "@/lib/mysql";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const watchlistOnly = req.nextUrl.searchParams.get("watchlist") === "1";
  const sinceHours = Number(req.nextUrl.searchParams.get("hours") ?? 72);

  let symbols: string[] | undefined;
  if (watchlistOnly) {
    const rows = await mysqlQuery<{ symbol: string }[]>(
      "select symbol from watchlist where user_id = ?",
      [user.id],
    );
    symbols = rows.map((r) => r.symbol);
    if (symbols.length === 0) return NextResponse.json({ changes: [] });
  }

  const changes = await listRecentRatingChanges({
    symbols,
    sinceHours: Number.isFinite(sinceHours) ? sinceHours : 72,
    limit: 80,
  });

  return NextResponse.json({ changes });
}
