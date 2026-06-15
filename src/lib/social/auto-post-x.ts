import { buildAnalysisSocialPool, type SocialPoolItem } from "@/lib/social/pool";
import {
  countAnalysisPostedToday,
  createSocialOpsRecord,
  isAnalysisPostedToday,
  updateSocialOpsRecord,
} from "@/lib/social/records";
import { isXPostingEnabled, postTweet } from "@/lib/social/x-api";
import { mysqlQuery } from "@/lib/mysql";

export type AutoPostXResult =
  | { ok: true; action: "skipped"; reason: string }
  | { ok: true; action: "dry_run"; item: SocialPoolItem }
  | { ok: true; action: "posted"; item: SocialPoolItem; tweetId: string; recordId: string }
  | { ok: false; error: string };

export type AutoPostXBatchResult = {
  ok: boolean;
  action: "skipped" | "dry_run" | "posted" | "partial";
  reason?: string;
  target: number;
  posted: number;
  failed: number;
  skipped: number;
  results: Array<
    | { ok: true; item: SocialPoolItem; tweetId: string; recordId: string }
    | { ok: false; item: SocialPoolItem; error: string }
  >;
};

const DEFAULT_DAILY_ANALYSIS_COUNT = 5;
const DEFAULT_SPACING_MS = 90_000;
const BATCH_LOCK_NAME = "ops_social_x_batch";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireBatchLock(): Promise<boolean> {
  const rows = await mysqlQuery<{ locked: number | null }[]>(
    `select get_lock(?, 0) as locked`,
    [BATCH_LOCK_NAME],
  );
  return Number(rows[0]?.locked) === 1;
}

async function releaseBatchLock(): Promise<void> {
  await mysqlQuery(`select release_lock(?)`, [BATCH_LOCK_NAME]).catch(() => null);
}

async function postOne(item: SocialPoolItem): Promise<
  | { ok: true; item: SocialPoolItem; tweetId: string; recordId: string }
  | { ok: false; item: SocialPoolItem; error: string }
> {
  if (await isAnalysisPostedToday(item.refKey)) {
    return { ok: false, item, error: "already posted today" };
  }

  try {
    const { tweetId } = await postTweet(item.xCopy);
    const record = await createSocialOpsRecord({
      contentType: item.contentType,
      refKey: item.refKey,
      title: item.title,
      canonicalUrl: item.xUrl,
      xCopy: item.xCopy,
      xhsCopy: item.xhsCopy,
      utmCampaign: item.utmCampaign,
      createdBy: "cron:x",
    });
    await updateSocialOpsRecord(record.id, {
      markPostedX: true,
      notes: `auto_post tweet_id=${tweetId}`,
    });
    return { ok: true, item, tweetId, recordId: record.id };
  } catch (e) {
    return { ok: false, item, error: e instanceof Error ? e.message : "post failed" };
  }
}

/** 每日批量发深度研报英文长文到 X */
export async function runAutoPostXBatch(opts: {
  count?: number;
  dryRun?: boolean;
  spacingMs?: number;
} = {}): Promise<AutoPostXBatchResult> {
  if (!isXPostingEnabled()) {
    return {
      ok: true,
      action: "skipped",
      reason: "X credentials missing",
      target: 0,
      posted: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  if (!opts.dryRun && !(await acquireBatchLock())) {
    return {
      ok: true,
      action: "skipped",
      reason: "another batch job is running",
      target: 0,
      posted: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  try {
    const target = Math.max(
      1,
      Math.min(10, opts.count ?? Number(process.env.X_DAILY_ANALYSIS_COUNT ?? DEFAULT_DAILY_ANALYSIS_COUNT)),
    );
    const spacingMs = opts.spacingMs ?? Number(process.env.X_POST_SPACING_MS ?? DEFAULT_SPACING_MS);

    const alreadyToday = await countAnalysisPostedToday();
    const remaining = Math.max(0, target - alreadyToday);
    if (remaining === 0) {
      return {
        ok: true,
        action: "skipped",
        reason: `already posted ${alreadyToday} analysis today (target ${target})`,
        target,
        posted: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    const pool = await buildAnalysisSocialPool(target + 8);
    const picks = pool.slice(0, remaining);
    if (picks.length === 0) {
      return {
        ok: true,
        action: "skipped",
        reason: "no eligible analysis in pool",
        target: remaining,
        posted: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    if (opts.dryRun) {
      return {
        ok: true,
        action: "dry_run",
        target: remaining,
        posted: 0,
        failed: 0,
        skipped: 0,
        results: picks.map((item) => ({ ok: true as const, item, tweetId: "dry-run", recordId: "dry-run" })),
      };
    }

    const results: AutoPostXBatchResult["results"] = [];
    let posted = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < picks.length; i++) {
      const item = picks[i]!;
      const out = await postOne(item);
      results.push(out);
      if (out.ok) posted++;
      else if (out.error === "already posted today") skipped++;
      else failed++;
      if (posted + skipped >= remaining) break;
      if (i < picks.length - 1 && spacingMs > 0 && out.ok) await sleep(spacingMs);
    }

    return {
      ok: failed === 0,
      action: failed > 0 && posted > 0 ? "partial" : "posted",
      target: remaining,
      posted,
      failed,
      skipped,
      results,
    };
  } finally {
    if (!opts.dryRun) await releaseBatchLock();
  }
}

/** 单条发帖（手动 / 兼容旧 cron） */
export async function runAutoPostX(opts: { dryRun?: boolean } = {}): Promise<AutoPostXResult> {
  const batch = await runAutoPostXBatch({ count: 1, dryRun: opts.dryRun, spacingMs: 0 });
  if (batch.action === "skipped") {
    return { ok: true, action: "skipped", reason: batch.reason ?? "skipped" };
  }
  if (batch.action === "dry_run" && batch.results[0]) {
    const r = batch.results[0];
    return { ok: true, action: "dry_run", item: r.item };
  }
  const first = batch.results.find((r) => r.ok);
  if (first && first.ok) {
    return { ok: true, action: "posted", item: first.item, tweetId: first.tweetId, recordId: first.recordId };
  }
  const failed = batch.results.find((r) => !r.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  return { ok: true, action: "skipped", reason: batch.reason ?? "no item" };
}
