import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  analyzeXWatchItemById,
  generateReplyForXWatchItemById,
  getXWatchItem,
  getXWatchMeta,
  listXWatchItems,
  pollXWatch,
  postXWatchReply,
  translateReplyForXWatchItemById,
  skipXWatchItem,
  updateXWatchDraft,
  type XWatchStatus,
} from "@/lib/x-watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as XWatchStatus | null;
  const limit = Number(url.searchParams.get("limit") ?? 40);

  const [meta, items] = await Promise.all([
    getXWatchMeta(),
    listXWatchItems(limit, status ?? undefined),
  ]);

  return NextResponse.json({ ok: true, meta, items });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    id?: string;
    reply_draft?: string;
    summary_md?: string;
    ops_angle_md?: string;
  } | null;

  const action = body?.action ?? "poll";

  if (action === "poll") {
    const result = await pollXWatch({ analyze: true });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json(result);
  }

  const id = body?.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  if (action === "translate_reply") {
    const result = await translateReplyForXWatchItemById(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    const item = await getXWatchItem(id);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "generate_reply") {
    const result = await generateReplyForXWatchItemById(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    const item = await getXWatchItem(id);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "analyze") {
    const result = await analyzeXWatchItemById(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    const item = await getXWatchItem(id);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "save_draft") {
    const result = await updateXWatchDraft(id, {
      reply_draft: body?.reply_draft,
      summary_md: body?.summary_md,
      ops_angle_md: body?.ops_angle_md,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    const item = await getXWatchItem(id);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "post_reply") {
    if (body?.reply_draft != null) {
      await updateXWatchDraft(id, { reply_draft: body.reply_draft });
    }
    const result = await postXWatchReply(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    const item = await getXWatchItem(id);
    return NextResponse.json({ ok: true, replyTweetId: result.replyTweetId, item, posted: true });
  }

  if (action === "skip") {
    const result = await skipXWatchItem(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
