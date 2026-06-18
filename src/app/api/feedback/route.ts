import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import {
  type ContentRefType,
  getFeedbackSummary,
  submitContentFeedback,
} from "@/lib/content-feedback";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRefType(v: unknown): ContentRefType | null {
  return v === "post" || v === "pick" ? v : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const refType = parseRefType(url.searchParams.get("refType"));
  const refKey = (url.searchParams.get("refKey") ?? "").trim();
  if (!refType || !refKey) {
    return NextResponse.json({ ok: false, error: "refType and refKey required" }, { status: 400 });
  }

  const [user, cookieStore] = await Promise.all([getSessionUser(), cookies()]);
  const visitorId = cookieStore.get("ops_vid")?.value ?? null;
  const actorKey = user?.id ?? visitorId;

  try {
    const summary = await getFeedbackSummary(refType, refKey, actorKey);
    return NextResponse.json({ ok: true, summary });
  } catch {
    return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    refType?: string;
    refKey?: string;
    helpful?: boolean;
    visitorId?: string;
  } | null;

  const refType = parseRefType(body?.refType);
  const refKey = (body?.refKey ?? "").trim();
  if (!refType || !refKey) {
    return NextResponse.json({ ok: false, error: "refType and refKey required" }, { status: 400 });
  }
  if (typeof body?.helpful !== "boolean") {
    return NextResponse.json({ ok: false, error: "helpful boolean required" }, { status: 400 });
  }

  const [user, cookieStore] = await Promise.all([getSessionUser(), cookies()]);
  const cookieVid = cookieStore.get("ops_vid")?.value ?? null;
  const visitorId = user ? null : (body?.visitorId ?? cookieVid);

  try {
    const result = await submitContentFeedback({
      refType,
      refKey,
      helpful: body.helpful,
      userId: user?.id ?? null,
      visitorId,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    logEvent("content_feedback", {
      userId: user?.id ?? null,
      meta: {
        ref_type: refType,
        ref_key: refKey,
        helpful: body.helpful,
        visitor_id: visitorId,
      },
    });

    return NextResponse.json({ ok: true, summary: result.summary });
  } catch {
    return NextResponse.json({ ok: false, error: "submit failed" }, { status: 500 });
  }
}
