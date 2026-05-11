import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { listPositions, upsertPosition } from "@/lib/portfolio";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const positions = await listPositions(user.id);
  return NextResponse.json({ positions });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: {
    symbol?: string;
    qty?: number;
    avgCost?: number;
    openedAt?: string | null;
    notes?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const symbol = (body.symbol ?? "").trim().toUpperCase();
  const qty = Number(body.qty);
  const avgCost = Number(body.avgCost);
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  if (!Number.isFinite(qty) || qty <= 0)
    return NextResponse.json({ error: "qty 必须 > 0" }, { status: 400 });
  if (!Number.isFinite(avgCost) || avgCost <= 0)
    return NextResponse.json({ error: "avg_cost 必须 > 0" }, { status: 400 });

  try {
    const id = await upsertPosition({
      userId: user.id,
      symbol,
      qty,
      avgCost,
      openedAt: body.openedAt ?? null,
      notes: body.notes?.slice(0, 500) ?? null,
    });
    return NextResponse.json({ id, symbol });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "新增失败" },
      { status: 400 },
    );
  }
}
