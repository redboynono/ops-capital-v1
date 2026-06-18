import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import {
  generateEditionSignals,
  getOrCreateDraftEdition,
  listEditions,
  mondayEditionDate,
} from "@/lib/ai-signals";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

async function authorizeCron(): Promise<boolean> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && bearer === `Bearer ${expected}`);
}

/** POST /api/cron/ai-weekly-signals — 周一自动生成 draft 周选 */
export async function POST(req: Request) {
  if (!(await authorizeCron())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const editionDate = url.searchParams.get("date") ?? mondayEditionDate();

  try {
    const edition = await getOrCreateDraftEdition(editionDate);
    const result = await generateEditionSignals(edition.id, { force });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, editionId: edition.id }, { status: 502 });
    }

    logEvent("ai_signals_generated", {
      meta: { edition_id: edition.id, edition_date: editionDate, count: result.count, failures: result.failures },
    });

    return NextResponse.json({
      ok: true,
      editionId: edition.id,
      editionDate,
      count: result.count,
      failures: result.failures,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** GET — admin 手动触发（需 admin session） */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const editions = await listEditions(30);
  return NextResponse.json({ ok: true, editions });
}
