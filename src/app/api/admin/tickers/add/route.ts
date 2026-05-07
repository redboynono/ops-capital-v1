import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { mysqlQuery } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/tickers/add
 *
 * Promotes an unlisted ticker (currently shown via Finnhub fallback) into
 * our `tickers` table so it appears in the index, becomes ratable, and
 * gets picked up by the daily ratings cron.
 *
 * Accepts both form-encoded (from the inline button on /t/[symbol]
 * fallback view) and JSON bodies.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let symbol = "";
  let name = "";
  let exchange = "OTHER";
  let sector: string | null = null;

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, string>;
    symbol = (body.symbol ?? "").toUpperCase();
    name = body.name ?? "";
    exchange = body.exchange || "OTHER";
    sector = body.sector || null;
  } else {
    const form = await req.formData();
    symbol = String(form.get("symbol") ?? "").toUpperCase();
    name = String(form.get("name") ?? "");
    exchange = String(form.get("exchange") ?? "OTHER") || "OTHER";
    sector = (form.get("sector") as string | null) || null;
  }

  if (!symbol || !name) {
    return NextResponse.json({ error: "symbol and name required" }, { status: 400 });
  }

  // Idempotent: ON DUPLICATE KEY UPDATE keeps existing rows but refreshes name/exchange/sector
  await mysqlQuery(
    `insert into tickers (symbol, name, exchange, sector)
     values (?, ?, ?, ?)
     on duplicate key update name = values(name), exchange = values(exchange), sector = values(sector)`,
    [symbol, name, exchange, sector],
  );

  // Redirect back to the ticker page (form submit) or return JSON
  if (ct.includes("application/json")) {
    return NextResponse.json({ ok: true, symbol });
  }
  return NextResponse.redirect(new URL(`/t/${encodeURIComponent(symbol)}`, req.url), 303);
}
