import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { deletePosition, updatePositionById } from "@/lib/portfolio";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;

  let body: {
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

  try {
    await updatePositionById(user.id, id, {
      qty: body.qty != null ? Number(body.qty) : undefined,
      avgCost: body.avgCost != null ? Number(body.avgCost) : undefined,
      openedAt: body.openedAt,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "更新失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  await deletePosition(user.id, id);
  return NextResponse.json({ ok: true });
}
