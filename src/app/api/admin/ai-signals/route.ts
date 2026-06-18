import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  generateEditionSignals,
  getEditionById,
  getOrCreateDraftEdition,
  listEditions,
  mondayEditionDate,
  publishEdition,
} from "@/lib/ai-signals";
import { sendEditionEmails } from "@/lib/ai-signals-mail";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const editions = await listEditions(30);
  return NextResponse.json({ ok: true, editions });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    editionId?: string;
    editionDate?: string;
    force?: boolean;
  } | null;

  const action = body?.action ?? "generate";

  if (action === "generate") {
    const edition = body?.editionId
      ? await getEditionById(body.editionId)
      : await getOrCreateDraftEdition(body?.editionDate ?? mondayEditionDate());
    if (!edition) {
      return NextResponse.json({ ok: false, error: "edition not found" }, { status: 404 });
    }

    const result = await generateEditionSignals(edition.id, { force: Boolean(body?.force) });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, editionId: edition.id, count: result.count, failures: result.failures });
  }

  if (action === "publish") {
    const editionId = body?.editionId;
    if (!editionId) {
      return NextResponse.json({ ok: false, error: "editionId required" }, { status: 400 });
    }
    const result = await publishEdition(editionId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    logEvent("ai_signals_published", { userId: auth.user.id, meta: { edition_id: editionId } });

    const email = await sendEditionEmails({ editionId });
    if (email.sent > 0) {
      logEvent("ai_signals_email_sent", {
        userId: auth.user.id,
        meta: { edition_id: editionId, sent: email.sent, failed: email.failed },
      });
    }

    return NextResponse.json({ ok: true, editionId, email });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
