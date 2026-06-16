import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { runJobTs } from "@/lib/observability";
import { runAutoPostX, runAutoPostXBatch } from "@/lib/social/auto-post-x";
import { isXPostingEnabled } from "@/lib/social/x-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

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
  const countStr = url.searchParams.get("count");
  const mode = url.searchParams.get("mode") ?? "analysis";
  const count = countStr ? Number(countStr) : undefined;
  const langParam = url.searchParams.get("lang");
  const lang = langParam === "en" || langParam === "zh" ? langParam : undefined;

  const out = await runJobTs({ jobName: "social-x-auto-post" }, async (ctx) => {
    const useBatch = mode === "analysis" || (count != null && count > 1);
    if (useBatch) {
      const result = await runAutoPostXBatch({ count, dryRun, lang });
      ctx.itemsTotal = result.target;
      ctx.itemsOk = result.posted;
      ctx.itemsFailed = result.failed;
      ctx.meta = { enabled: isXPostingEnabled(), dryRun, mode: "analysis_batch", ...result };
      return result;
    }
    const result = await runAutoPostX({ dryRun });
    ctx.meta = { enabled: isXPostingEnabled(), dryRun, mode: "single", action: result.ok ? result.action : "error" };
    if (result.ok && result.action === "posted") {
      ctx.itemsOk = 1;
      ctx.meta = { ...ctx.meta, tweetId: result.tweetId, refKey: result.item.refKey };
    }
    if (result.ok && result.action === "dry_run") {
      ctx.meta = { ...ctx.meta, refKey: result.item.refKey, title: result.item.title };
    }
    return result;
  });

  if ("error" in out && out.ok === false) {
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
