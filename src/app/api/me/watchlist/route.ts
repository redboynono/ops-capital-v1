import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "@/lib/tickers";

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
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  if (!body?.symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  await removeFromWatchlist(user.id, body.symbol);
  return NextResponse.json({ ok: true });
}
