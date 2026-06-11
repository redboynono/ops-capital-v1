import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { runJobTs } from "@/lib/observability";
import { runAutoPostX } from "@/lib/social/auto-post-x";
import { isXPostingEnabled } from "@/lib/social/x-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function handle(req: Request): Promise<NextResponse> {
  const authz = await authorize();
  if (!authz.ok) {
    return NextResponse.json({ error: "unauthorized", reason: authz.reason }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  const out = await runJobTs({ jobName: "social-x-auto-post" }, async (ctx) => {
    const result = await runAutoPostX({ dryRun });
    ctx.meta = {
      enabled: isXPostingEnabled(),
      dryRun,
      action: result.ok ? result.action : "error",
    };
    if (result.ok && result.action === "posted") {
      ctx.itemsOk = 1;
      ctx.meta = { ...ctx.meta, tweetId: result.tweetId, refKey: result.item.refKey };
    }
    if (result.ok && result.action === "dry_run") {
      ctx.meta = { ...ctx.meta, refKey: result.item.refKey, title: result.item.title };
    }
    return result;
  });

  if (!out.ok && "error" in out) {
    return NextResponse.json(out, { status: 502 });
  }
  return NextResponse.json(out);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
