import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { pollXWatch } from "@/lib/x-watch";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorizeCron(): Promise<boolean> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && bearer === `Bearer ${expected}`);
}

/** POST /api/cron/x-watch — 拉取 @aleabitoreddit 新帖并生成回复草稿 */
export async function POST() {
  if (!(await authorizeCron())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await pollXWatch({ analyze: true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  logEvent("x_watch_polled", {
    meta: {
      username: result.username,
      fetched: result.fetched,
      inserted: result.inserted,
      analyzed: result.analyzed,
    },
  });

  return NextResponse.json(result);
}
