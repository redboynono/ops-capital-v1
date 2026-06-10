import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { listPicksForList, upsertConvictionPick } from "@/lib/conviction";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const picks = await listPicksForList(id);
  return NextResponse.json({ picks });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  let body: {
    symbol?: string;
    entryPrice?: number;
    weight?: number;
    thesis?: string | null;
    sortOrder?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const pickId = await upsertConvictionPick({
      listId: id,
      symbol: body.symbol,
      entryPrice: Number(body.entryPrice),
      weight: Number(body.weight ?? 0.1),
      thesis: body.thesis ?? null,
      sortOrder: body.sortOrder ?? 0,
    });
    return NextResponse.json({ id: pickId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upsert failed" },
      { status: 400 },
    );
  }
}
