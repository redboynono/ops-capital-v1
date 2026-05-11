import { NextResponse } from "next/server";

import { deleteAlert, toggleAlert } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;

  let body: { isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.isActive !== "boolean")
    return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });

  await toggleAlert(user.id, id, body.isActive);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  await deleteAlert(user.id, id);
  return NextResponse.json({ ok: true });
}
