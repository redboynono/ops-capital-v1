import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addBookmark, listBookmarks, removeBookmark } from "@/lib/me";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await listBookmarks(user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { postId?: string } | null;
  if (!body?.postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  await addBookmark(user.id, body.postId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { postId?: string } | null;
  if (!body?.postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  await removeBookmark(user.id, body.postId);
  return NextResponse.json({ ok: true });
}
