/**
 * AI 周选 — Weekly Signals for Research Pro
 */
import { randomUUID } from "node:crypto";

import { generatePickDraft } from "@/lib/ai/generatePick";
import { plainTeaser } from "@/lib/content-preview";
import { mysqlQuery } from "@/lib/mysql";
import { gradePassesMin, listScreenerRows, type ScreenerRow } from "@/lib/screener";
import type { Verdict } from "@/lib/ratings";
import { getTickerBySymbol } from "@/lib/tickers";

export const SIGNALS_PER_EDITION = 5;
export const CANDIDATE_POOL_SIZE = 8;

export type EditionStatus = "draft" | "published";

export type AiSignalEdition = {
  id: string;
  edition_date: string;
  cadence: "weekly";
  status: EditionStatus;
  summary_md: string | null;
  published_at: string | null;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiSignal = {
  id: string;
  edition_id: string;
  rank_no: number;
  ticker_symbol: string;
  ticker_name: string | null;
  ops_verdict: Verdict | null;
  ops_score: number | null;
  ai_score: number | null;
  conviction: "high" | "medium" | "low";
  headline: string;
  reason_teaser: string;
  reason_md: string;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  source_snapshot_json: Record<string, unknown> | null;
  created_at: string;
};

export type AiSignalEditionWithSignals = AiSignalEdition & { signals: AiSignal[] };

type EditionRow = AiSignalEdition;
type SignalRow = Omit<AiSignal, "entry_price" | "target_price" | "stop_price" | "ops_score" | "ai_score" | "source_snapshot_json"> & {
  entry_price: string | number | null;
  target_price: string | number | null;
  stop_price: string | number | null;
  ops_score: string | number | null;
  ai_score: string | number | null;
  source_snapshot_json: string | Record<string, unknown> | null;
};

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowToSignal(r: SignalRow): AiSignal {
  let snapshot: Record<string, unknown> | null = null;
  if (r.source_snapshot_json) {
    snapshot =
      typeof r.source_snapshot_json === "string"
        ? (JSON.parse(r.source_snapshot_json) as Record<string, unknown>)
        : r.source_snapshot_json;
  }
  return {
    ...r,
    ops_verdict: (r.ops_verdict as Verdict | null) ?? null,
    ops_score: num(r.ops_score),
    ai_score: num(r.ai_score),
    entry_price: num(r.entry_price),
    target_price: num(r.target_price),
    stop_price: num(r.stop_price),
    source_snapshot_json: snapshot,
  };
}

/** 本周一（UTC）YYYY-MM-DD */
export function mondayEditionDate(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x.toISOString().slice(0, 10);
}

export async function pickWeeklyCandidates(maxCandidates = CANDIDATE_POOL_SIZE): Promise<ScreenerRow[]> {
  const [rows, openPicks, recentSymbols] = await Promise.all([
    listScreenerRows(),
    mysqlQuery<Array<{ ticker_symbol: string }>>(
      `select ticker_symbol from ops_picks where is_published = 1 and status = 'open'`,
    ),
    mysqlQuery<Array<{ ticker_symbol: string }>>(
      `select distinct s.ticker_symbol
         from ai_signals s
         join ai_signal_editions e on e.id = s.edition_id
        where e.status = 'published'
          and e.edition_date >= date_sub(current_date, interval 28 day)`,
    ),
  ]);

  const exclude = new Set([
    ...openPicks.map((r) => r.ticker_symbol),
    ...recentSymbols.map((r) => r.ticker_symbol),
  ]);

  return rows
    .filter((r) => {
      if (exclude.has(r.symbol)) return false;
      if (!r.ops_score || r.ops_score < 4.0) return false;
      if (r.ops_verdict !== "BUY" && r.ops_verdict !== "STRONG_BUY") return false;
      if (!gradePassesMin(r.grades.MOMENTUM, 3.0)) return false;
      return true;
    })
    .sort((a, b) => {
      const sa = a.ops_score ?? 0;
      const sb = b.ops_score ?? 0;
      if (sb !== sa) return sb - sa;
      const ra = a.rank_overall ?? 9999;
      const rb = b.rank_overall ?? 9999;
      return ra - rb;
    })
    .slice(0, maxCandidates);
}

export async function listEditions(limit = 20): Promise<AiSignalEdition[]> {
  return mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions order by edition_date desc limit ?`,
    [limit],
  );
}

export async function getEditionById(id: string): Promise<AiSignalEditionWithSignals | null> {
  const [edition] = await mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions where id = ? limit 1`,
    [id],
  );
  if (!edition) return null;
  const signals = await listSignalsForEdition(edition.id);
  return { ...edition, signals };
}

export async function getEditionByDate(
  editionDate: string,
  opts?: { includeDraft?: boolean },
): Promise<AiSignalEditionWithSignals | null> {
  const statusSql = opts?.includeDraft ? "" : "and status = 'published'";
  const [edition] = await mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions where edition_date = ? ${statusSql} limit 1`,
    [editionDate],
  );
  if (!edition) return null;
  const signals = await listSignalsForEdition(edition.id);
  return { ...edition, signals };
}

export async function getLatestPublishedEdition(): Promise<AiSignalEditionWithSignals | null> {
  const [edition] = await mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions where status = 'published' order by edition_date desc limit 1`,
  );
  if (!edition) return null;
  const signals = await listSignalsForEdition(edition.id);
  return { ...edition, signals };
}

export async function listPublishedEditionDates(limit = 12): Promise<string[]> {
  const rows = await mysqlQuery<Array<{ edition_date: string }>>(
    `select edition_date from ai_signal_editions where status = 'published' order by edition_date desc limit ?`,
    [limit],
  );
  return rows.map((r) => String(r.edition_date).slice(0, 10));
}

async function listSignalsForEdition(editionId: string): Promise<AiSignal[]> {
  const rows = await mysqlQuery<SignalRow[]>(
    `select * from ai_signals where edition_id = ? order by rank_no asc`,
    [editionId],
  );
  return rows.map(rowToSignal);
}

export async function getOrCreateDraftEdition(editionDate?: string): Promise<AiSignalEdition> {
  const date = editionDate ?? mondayEditionDate();
  const [existing] = await mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions where edition_date = ? limit 1`,
    [date],
  );
  if (existing) return existing;

  const id = randomUUID();
  await mysqlQuery(
    `insert into ai_signal_editions (id, edition_date, cadence, status) values (?, ?, 'weekly', 'draft')`,
    [id, date],
  );
  const [created] = await mysqlQuery<EditionRow[]>(
    `select * from ai_signal_editions where id = ? limit 1`,
    [id],
  );
  return created!;
}

function convictionToAiScore(c: "high" | "medium" | "low"): number {
  if (c === "high") return 9;
  if (c === "medium") return 7;
  return 5;
}

function draftToSignalInput(
  draft: Awaited<ReturnType<typeof generatePickDraft>>,
  row: ScreenerRow,
  rank: number,
): Omit<AiSignal, "id" | "edition_id" | "created_at"> {
  const reasonMd = [draft.thesis_md, draft.catalysts_md ? `\n\n${draft.catalysts_md}` : ""]
    .filter(Boolean)
    .join("")
    .trim();
  const headline = draft.subtitle?.trim() || draft.title.trim();
  const teaser = plainTeaser(reasonMd, 140);

  return {
    rank_no: rank,
    ticker_symbol: draft.ticker_symbol,
    ticker_name: draft.ticker_name ?? row.name,
    ops_verdict: row.ops_verdict,
    ops_score: row.ops_score,
    ai_score: convictionToAiScore(draft.conviction),
    conviction: draft.conviction,
    headline: headline.slice(0, 255),
    reason_teaser: teaser.slice(0, 320),
    reason_md: reasonMd,
    entry_price: draft.entry_price > 0 ? draft.entry_price : null,
    target_price: draft.target_price,
    stop_price: draft.stop_price,
    source_snapshot_json: {
      ops_verdict: row.ops_verdict,
      ops_score: row.ops_score,
      rank_overall: row.rank_overall,
      source_summary: draft.source_summary,
      generated_at: new Date().toISOString(),
    },
  };
}

export async function generateEditionSignals(
  editionId: string,
  opts?: { force?: boolean; maxSignals?: number },
): Promise<{ ok: true; count: number; failures: string[] } | { ok: false; error: string }> {
  const edition = await getEditionById(editionId);
  if (!edition) return { ok: false, error: "edition not found" };
  if (edition.status === "published") return { ok: false, error: "edition already published" };

  if (edition.signals.length > 0 && !opts?.force) {
    return { ok: true, count: edition.signals.length, failures: [] };
  }

  if (opts?.force && edition.signals.length > 0) {
    await mysqlQuery(`delete from ai_signals where edition_id = ?`, [editionId]);
  }

  const candidates = await pickWeeklyCandidates();
  if (candidates.length === 0) {
    return { ok: false, error: "no screener candidates" };
  }

  const target = opts?.maxSignals ?? SIGNALS_PER_EDITION;
  const failures: string[] = [];
  let rank = 0;

  for (const row of candidates) {
    if (rank >= target) break;
    const ticker = await getTickerBySymbol(row.symbol);
    if (!ticker) {
      failures.push(`${row.symbol}: ticker not in DB`);
      continue;
    }

    try {
      const draft = await generatePickDraft(row.symbol, {
        name: ticker.name,
        sector: ticker.sector,
      });
      if (!draft.thesis_md?.trim()) {
        failures.push(`${row.symbol}: empty thesis`);
        continue;
      }
      if (draft.target_price != null && draft.entry_price > 0 && draft.target_price <= draft.entry_price) {
        failures.push(`${row.symbol}: target <= entry`);
        continue;
      }

      rank += 1;
      const input = draftToSignalInput(draft, row, rank);
      await mysqlQuery(
        `insert into ai_signals (
           id, edition_id, rank_no, ticker_symbol, ticker_name,
           ops_verdict, ops_score, ai_score, conviction,
           headline, reason_teaser, reason_md,
           entry_price, target_price, stop_price, source_snapshot_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          editionId,
          input.rank_no,
          input.ticker_symbol,
          input.ticker_name,
          input.ops_verdict,
          input.ops_score,
          input.ai_score,
          input.conviction,
          input.headline,
          input.reason_teaser,
          input.reason_md,
          input.entry_price,
          input.target_price,
          input.stop_price,
          JSON.stringify(input.source_snapshot_json),
        ],
      );
    } catch (e) {
      failures.push(`${row.symbol}: ${e instanceof Error ? e.message : "generate failed"}`);
    }
  }

  if (rank === 0) {
    return { ok: false, error: `all candidates failed: ${failures.join("; ")}` };
  }

  const summary = `本周 AI 周选 ${rank} 只 · OPS 量化预筛 + AI 深度理由`;
  await mysqlQuery(`update ai_signal_editions set summary_md = ?, updated_at = current_timestamp(3) where id = ?`, [
    summary,
    editionId,
  ]);

  return { ok: true, count: rank, failures };
}

export async function publishEdition(editionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const edition = await getEditionById(editionId);
  if (!edition) return { ok: false, error: "edition not found" };
  if (edition.status === "published") return { ok: true };
  if (edition.signals.length === 0) return { ok: false, error: "no signals to publish" };

  await mysqlQuery(
    `update ai_signal_editions
        set status = 'published', published_at = current_timestamp(3), updated_at = current_timestamp(3)
      where id = ?`,
    [editionId],
  );
  return { ok: true };
}

export async function markEditionEmailSent(editionId: string): Promise<void> {
  await mysqlQuery(
    `update ai_signal_editions set email_sent_at = current_timestamp(3), updated_at = current_timestamp(3) where id = ?`,
    [editionId],
  );
}

export async function getResearchProEmailRecipients(): Promise<Array<{ email: string; locale: string }>> {
  return mysqlQuery<Array<{ email: string; locale: string }>>(
    `select email, coalesce(locale, 'zh') as locale
       from users
      where email is not null
        and trim(email) != ''
        and entitlement_research = 1
        and subscription_status = 'active'`,
  );
}
