import { NextResponse } from "next/server";
import { mysqlQuery } from "@/lib/mysql";
import { fetchEarningsCalendar } from "@/lib/finnhub";
import {
  listPendingEarnings,
  recordGenerationFailure,
  upsertEarningsRelease,
} from "@/lib/earnings";
import { generateAndSaveEarningsPost } from "@/lib/ai/generateEarningsArticle";
import { isAdminEmail } from "@/lib/admin";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 分钟，AI 生成可能耗时

type ScanResult = {
  ok: boolean;
  scanned_window: { from: string; to: string };
  finnhub_total: number;
  matched_our_tickers: number;
  upserted: number;
  pending: number;
  generated: Array<{ symbol: string; year: number; quarter: number; post_id: string; slug: string }>;
  failures: Array<{ symbol: string; year: number; quarter: number; error: string }>;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function authorize(req: Request): Promise<{ ok: boolean; reason?: string }> {
  // 1) cron header（Bearer CRON_SECRET）
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return { ok: true };

  // 2) admin session（手动从后台触发）
  const user = await getSessionUser();
  if (user && isAdminEmail(user.email)) return { ok: true };

  return { ok: false, reason: "missing CRON_SECRET bearer or admin session" };
}

/** GET = same as POST，方便 curl / 浏览器手动触发 */
export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(14, Number(url.searchParams.get("days") ?? 3)));
  const dryRun = url.searchParams.get("dry_run") === "1";

  const today = new Date();
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - days);
  const fromISO = isoDate(past);
  const toISO = isoDate(today);

  const out: ScanResult = {
    ok: true,
    scanned_window: { from: fromISO, to: toISO },
    finnhub_total: 0,
    matched_our_tickers: 0,
    upserted: 0,
    pending: 0,
    generated: [],
    failures: [],
  };

  // ----- step 1: pull whole-market earnings calendar -----
  let calendar;
  try {
    calendar = await fetchEarningsCalendar(fromISO, toISO);
  } catch (e) {
    return NextResponse.json(
      { error: "finnhub failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
  out.finnhub_total = calendar.length;

  // ----- step 2: filter to our covered tickers -----
  const ours = await mysqlQuery<{ symbol: string }[]>("select symbol from tickers");
  const ourSet = new Set(ours.map((r) => r.symbol.toUpperCase()));
  const matched = calendar.filter((c) => c.symbol && ourSet.has(c.symbol.toUpperCase()));
  out.matched_our_tickers = matched.length;

  if (dryRun) {
    return NextResponse.json({ ...out, sample: matched.slice(0, 10) });
  }

  // ----- step 3: upsert earnings rows (only those with eps_actual or revenue_actual non-null
  //               also store estimates-only rows so we know they are scheduled) -----
  for (const row of matched) {
    try {
      await upsertEarningsRelease(row);
      out.upserted++;
    } catch (e) {
      out.failures.push({
        symbol: row.symbol,
        year: row.year,
        quarter: row.quarter,
        error: `upsert: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }
  }

  // ----- step 4: pull pending (released but no article) -----
  const symbols = Array.from(ourSet);
  const pending = await listPendingEarnings(symbols);
  out.pending = pending.length;

  // ----- step 5: generate one-by-one (sequential to avoid AI rate limit) -----
  for (const er of pending) {
    try {
      const result = await generateAndSaveEarningsPost(er);
      out.generated.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordGenerationFailure(er.id, msg);
      out.failures.push({
        symbol: er.symbol,
        year: er.fiscal_year,
        quarter: er.fiscal_quarter,
        error: msg,
      });
    }
  }

  return NextResponse.json(out);
}
