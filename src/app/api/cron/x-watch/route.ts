import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { pollAllXWatch } from "@/lib/x-watch";
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

/** POST /api/cron/x-watch — 拉取 @aleabitoreddit 新帖、AI 分析，并按配置自动 Quote 回复 */
export async function POST() {
  if (!(await authorizeCron())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await pollAllXWatch({ analyze: true });
  if (!result.ok && result.inserted === 0 && result.fetched === 0) {
    return NextResponse.json({ ok: false, error: result.errors?.join("; ") ?? "poll failed" }, { status: 502 });
  }

  logEvent("x_watch_polled", {
    meta: {
      usernames: result.usernames,
      fetched: result.fetched,
      inserted: result.inserted,
      analyzed: result.analyzed,
      autoPosted: result.autoPosted,
      autoSkipped: result.autoSkipped,
      autoFailed: result.autoFailed,
      metricsSynced: result.metricsSynced,
      errors: result.errors,
    },
  });

  return NextResponse.json(result);
}
