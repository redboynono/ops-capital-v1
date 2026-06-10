import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { deletePick, getPickById } from "@/lib/picks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await getPickById(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deletePick(id);
  return NextResponse.json({ ok: true });
}
