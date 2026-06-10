import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { buildSocialContentPool } from "@/lib/social/pool";
import {
  createSocialOpsRecord,
  listSocialOpsRecords,
  type SocialContentType,
} from "@/lib/social/records";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const [pool, records] = await Promise.all([
      buildSocialContentPool(12),
      listSocialOpsRecords({ limit: 30 }),
    ]);
    return NextResponse.json({ pool, records });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "load failed";
    if (/social_ops_posts|doesn't exist/i.test(msg)) {
      return NextResponse.json(
        { error: "请先执行 mysql/migrations/017_social_ops.sql", code: "migration_required" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    contentType?: string;
    refKey?: string | null;
    title?: string;
    canonicalUrl?: string;
    xCopy?: string;
    xhsCopy?: string;
    utmCampaign?: string | null;
  } | null;

  if (!body?.title || !body.canonicalUrl || !body.xCopy || !body.xhsCopy || !body.contentType) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const allowed: SocialContentType[] = ["analysis", "news", "rating_change", "value_chain", "custom"];
  if (!allowed.includes(body.contentType as SocialContentType)) {
    return NextResponse.json({ error: "invalid contentType" }, { status: 400 });
  }

  try {
    const record = await createSocialOpsRecord({
      contentType: body.contentType as SocialContentType,
      refKey: body.refKey ?? null,
      title: body.title,
      canonicalUrl: body.canonicalUrl,
      xCopy: body.xCopy,
      xhsCopy: body.xhsCopy,
      utmCampaign: body.utmCampaign ?? null,
      createdBy: auth.user.email,
    });
    return NextResponse.json({ record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
