import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "@/lib/tickers";
import { logEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listWatchlist(user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  if (!body?.symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  await addToWatchlist(user.id, body.symbol);
  logEvent("watchlist_add", { userId: user.id, symbol: body.symbol });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  if (!body?.symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  await removeFromWatchlist(user.id, body.symbol);
  logEvent("watchlist_remove", { userId: user.id, symbol: body.symbol });
  return NextResponse.json({ ok: true });
}
