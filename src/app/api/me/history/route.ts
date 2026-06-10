import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { recordRead, listHistory } from "@/lib/me";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await listHistory(user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false });

  const body = (await req.json().catch(() => null)) as { postId?: string } | null;
  if (!body?.postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  await recordRead(user.id, body.postId);
  return NextResponse.json({ ok: true });
}
