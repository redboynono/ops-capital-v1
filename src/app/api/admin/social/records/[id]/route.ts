import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getSocialOpsRecord, updateSocialOpsRecord } from "@/lib/social/records";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    xCopy?: string;
    xhsCopy?: string;
    notes?: string | null;
    status?: "draft" | "posted_x" | "posted_xhs" | "done";
    markPostedX?: boolean;
    markPostedXhs?: boolean;
  } | null;

  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const record = await updateSocialOpsRecord(id, {
    title: body.title,
    xCopy: body.xCopy,
    xhsCopy: body.xhsCopy,
    notes: body.notes,
    status: body.status,
    markPostedX: body.markPostedX,
    markPostedXhs: body.markPostedXhs,
  });

  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const record = await getSocialOpsRecord(id);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record });
}
