import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { deleteConvictionList, updateConvictionList } from "@/lib/conviction";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  let body: {
    periodLabel?: string;
    publishDate?: string;
    endDate?: string | null;
    thesis?: string | null;
    isActive?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  await updateConvictionList(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  await deleteConvictionList(id);
  return NextResponse.json({ ok: true });
}
