import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { mysqlQuery } from "@/lib/mysql";

export const dynamic = "force-dynamic";

function rankList(rows: { symbol: string; quant_score: string | null }[]) {
  const sorted = [...rows]
    .filter((r) => r.quant_score != null)
    .sort((a, b) => Number(b.quant_score) - Number(a.quant_score));
  const total = sorted.length;
  const map = new Map<string, { rank: number; total: number }>();
  sorted.forEach((r, i) => map.set(r.symbol, { rank: i + 1, total }));
  return map;
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rows = await mysqlQuery<
    { symbol: string; quant_score: string | null; sector: string | null; industry: string | null }[]
  >(
    `select r.symbol, r.quant_score, r.industry, t.sector
       from ticker_ratings r
       inner join tickers t on t.symbol = r.symbol
      where r.quant_score is not null`,
  );

  const overall = rankList(rows);
  const bySector = new Map<string, typeof rows>();
  const byIndustry = new Map<string, typeof rows>();
  for (const r of rows) {
    const sk = r.sector ?? "OTHER";
    if (!bySector.has(sk)) bySector.set(sk, []);
    bySector.get(sk)!.push(r);
    const ik = r.industry ?? "Unknown";
    if (!byIndustry.has(ik)) byIndustry.set(ik, []);
    byIndustry.get(ik)!.push(r);
  }

  const sectorRanks = new Map<string, { rank: number; total: number }>();
  for (const list of bySector.values()) {
    for (const [sym, v] of rankList(list)) sectorRanks.set(sym, v);
  }
  const industryRanks = new Map<string, { rank: number; total: number }>();
  for (const list of byIndustry.values()) {
    for (const [sym, v] of rankList(list)) industryRanks.set(sym, v);
  }

  let updated = 0;
  for (const r of rows) {
    const o = overall.get(r.symbol);
    const s = sectorRanks.get(r.symbol);
    const i = industryRanks.get(r.symbol);
    await mysqlQuery(
      `update ticker_ratings set
         rank_overall = ?, rank_overall_total = ?,
         rank_sector = ?, rank_sector_total = ?,
         rank_industry = ?, rank_industry_total = ?
       where symbol = ?`,
      [
        o?.rank ?? null,
        o?.total ?? null,
        s?.rank ?? null,
        s?.total ?? null,
        i?.rank ?? null,
        i?.total ?? null,
        r.symbol,
      ],
    );
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
