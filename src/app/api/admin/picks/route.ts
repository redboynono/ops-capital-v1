import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { upsertPick, type UpsertPickInput } from "@/lib/picks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as UpsertPickInput | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const required = ["slug", "ticker_symbol", "title", "thesis_md", "entry_price", "entry_date"] as const;
  for (const k of required) {
    if (body[k] == null || body[k] === "") {
      return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    }
  }

  const entryPrice = Number(body.entry_price);
  if (!isFinite(entryPrice) || entryPrice <= 0) {
    return NextResponse.json({ error: "entry_price must be > 0" }, { status: 400 });
  }

  try {
    const { id } = await upsertPick({
      ...body,
      entry_price: entryPrice,
      target_price: body.target_price != null ? Number(body.target_price) : null,
      stop_price: body.stop_price != null ? Number(body.stop_price) : null,
      close_price: body.close_price != null ? Number(body.close_price) : null,
      horizon_months: body.horizon_months ? Number(body.horizon_months) : 12,
      created_by: auth.user.id,
    });
    return NextResponse.json({ ok: true, id, slug: body.slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
