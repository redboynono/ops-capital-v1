import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { sendEditionEmails } from "@/lib/ai-signals-mail";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(): Promise<boolean> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && bearer === `Bearer ${expected}`);
}

/** POST — 向 Research Pro 会员发送最新已发布周选邮件 */
export async function POST(req: Request) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId") ?? undefined;
  const force = url.searchParams.get("force") === "1";

  const result = await sendEditionEmails({ editionId, force });

  if (result.sent > 0) {
    logEvent("ai_signals_email_sent", {
      meta: { edition_id: result.editionId, sent: result.sent, failed: result.failed },
    });
  }

  return NextResponse.json(result);
}
