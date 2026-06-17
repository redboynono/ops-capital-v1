import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { getTrackRecordTeaser } from "@/lib/track-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorize(): Promise<{ ok: boolean; reason?: string }> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && bearer === `Bearer ${expected}`) return { ok: true };
  try {
    const auth = await requireAdmin();
    if (auth.ok) return { ok: true };
  } catch {
    // ignore
  }
  return { ok: false, reason: "missing CRON_SECRET bearer or admin session" };
}

export async function POST() {
  const authz = await authorize();
  if (!authz.ok) {
    return NextResponse.json({ error: "unauthorized", reason: authz.reason }, { status: 401 });
  }

  const teaser = await getTrackRecordTeaser();
  return NextResponse.json({
    ok: true,
    buyCount: teaser?.buyCount ?? 0,
    buyWinRate: teaser?.buyWinRate ?? null,
    buyAvgExcess: teaser?.buyAvgExcess ?? null,
    top: teaser?.top ?? [],
  });
}
