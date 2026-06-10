import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { deleteConvictionPick } from "@/lib/conviction";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pickId: string }> },
) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, pickId } = await params;
  await deleteConvictionPick(id, pickId);
  return NextResponse.json({ ok: true });
}
