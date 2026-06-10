import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { createConvictionList, listAllConvictionLists } from "@/lib/conviction";

export async function GET() {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const lists = await listAllConvictionLists();
  return NextResponse.json({ lists });
}

export async function POST(req: Request) {
  const { ok } = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { periodLabel?: string; publishDate?: string; thesis?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const periodLabel = (body.periodLabel ?? "").trim();
  const publishDate = (body.publishDate ?? "").trim();
  if (!periodLabel) return NextResponse.json({ error: "periodLabel required" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate))
    return NextResponse.json({ error: "publishDate must be YYYY-MM-DD" }, { status: 400 });

  try {
    const id = await createConvictionList({ periodLabel, publishDate, thesis: body.thesis ?? null });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "create failed" },
      { status: 400 },
    );
  }
}
