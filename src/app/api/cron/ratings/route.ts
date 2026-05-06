import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { listAllTickers } from "@/lib/tickers";
import { generateAndSaveRating } from "@/lib/ai/generateRating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

async function authorize(): Promise<{ ok: boolean; reason?: string }> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && bearer === `Bearer ${expected}`) return { ok: true };

  // fallback: admin session for manual trigger
  try {
    const auth = await requireAdmin();
    if (auth.ok) return { ok: true };
  } catch {
    // ignore
  }
  return { ok: false, reason: "missing CRON_SECRET bearer or admin session" };
}

type Out = {
  total: number;
  refreshed: number;
  skipped: number;
  failures: { symbol: string; error: string }[];
};

async function handle(req: Request): Promise<NextResponse> {
  const authz = await authorize();
  if (!authz.ok) {
    return NextResponse.json({ error: "unauthorized", reason: authz.reason }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Math.max(1, Math.min(200, Number(limitStr))) : 200;
  const onlySymbol = url.searchParams.get("symbol");

  const tickers = await listAllTickers();
  const targets = onlySymbol
    ? tickers.filter((t) => t.symbol === onlySymbol.toUpperCase())
    : tickers.slice(0, limit);

  const out: Out = { total: targets.length, refreshed: 0, skipped: 0, failures: [] };

  // sequential to stay under AI rate limit
  for (const t of targets) {
    try {
      await generateAndSaveRating(
        t.symbol,
        { name: t.name, sector: t.sector },
        "CRON",
      );
      out.refreshed++;
      // tiny delay so we don't hammer upstream
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      out.failures.push({
        symbol: t.symbol,
        error: e instanceof Error ? e.message.slice(0, 200) : "unknown",
      });
    }
  }

  return NextResponse.json(out);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
