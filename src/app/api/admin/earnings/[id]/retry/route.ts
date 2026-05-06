import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { mysqlQuery } from "@/lib/mysql";
import { generateAndSaveEarningsPost } from "@/lib/ai/generateEarningsArticle";
import { recordGenerationFailure, type EarningsRow } from "@/lib/earnings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  // 重置失败计数并拉取完整记录
  await mysqlQuery(
    "update earnings_releases set generation_attempts = 0, last_error = null where id = ?",
    [id],
  );

  const rows = await mysqlQuery<EarningsRow[]>(
    `select id, symbol, fiscal_year, fiscal_quarter, report_date, hour,
            eps_actual, eps_estimate, revenue_actual, revenue_estimate,
            post_id, generation_attempts, last_error
       from earnings_releases where id = ? limit 1`,
    [id],
  );
  const er = rows[0];
  if (!er) return NextResponse.json({ error: "earnings row not found" }, { status: 404 });
  if (er.eps_actual == null) {
    return NextResponse.json(
      { error: "earnings not yet released (eps_actual is null)" },
      { status: 400 },
    );
  }

  try {
    const result = await generateAndSaveEarningsPost(er);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordGenerationFailure(er.id, msg);
    return NextResponse.json({ error: "generation failed", detail: msg }, { status: 502 });
  }
}
