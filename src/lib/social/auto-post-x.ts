import { buildAnalysisSocialPool, buildChokepointSocialPool, type SocialPoolItem } from "@/lib/social/pool";
import {
  countAnalysisPostedToday,
  createSocialOpsRecord,
  isAnalysisPostedToday,
  isRefPostedEver,
  updateSocialOpsRecord,
} from "@/lib/social/records";
import { isXPostingEnabled, postThread } from "@/lib/social/x-api";
import { buildTrackRecordThread, type TrackRecordCallLite } from "@/lib/social/copy";
import { getTrackRecord, isTrackRecordPresentable } from "@/lib/track-record";
import { withUtm, X_LANDING_PATH } from "@/lib/social/utm";
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
// 同一篇内中/英两条之间的间隔
const INTRA_VARIANT_SPACING_MS = 20_000;
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

async function postOne(
  item: SocialPoolItem,
  lang?: "zh" | "en",
): Promise<
  | { ok: true; item: SocialPoolItem; tweetId: string; recordId: string }
  | { ok: false; item: SocialPoolItem; error: string }
> {
  if (await isAnalysisPostedToday(item.refKey)) {
    return { ok: false, item, error: "already posted today" };
  }

  // 每个语种要发的「推文序列」：优先叙事 thread，回退单条文案
  type Send = { locale: "zh" | "en"; tweets: string[]; url: string };
  let sends: Send[];
  if (item.xThreads && item.xThreads.length > 0) {
    sends = item.xThreads.map((t) => ({ locale: t.locale, tweets: t.tweets, url: t.xUrl }));
  } else {
    const fallback = [{ locale: "en" as const, xCopy: item.xCopy, xUrl: item.xUrl }];
    const vs = item.xVariants && item.xVariants.length > 0 ? item.xVariants : fallback;
    sends = vs.map((v) => ({ locale: v.locale, tweets: [v.xCopy], url: v.xUrl }));
  }
  if (lang) sends = sends.filter((s) => s.locale === lang);
  if (sends.length === 0) {
    return { ok: false, item, error: `no ${lang} variant available` };
  }

  const tweetIds: string[] = [];
  let lastError: string | null = null;
  for (let i = 0; i < sends.length; i++) {
    const s = sends[i]!;
    try {
      const { tweetIds: ids } = await postThread(s.tweets);
      tweetIds.push(`${s.locale}=${ids[0]}${ids.length > 1 ? `(+${ids.length - 1})` : ""}`);
      if (i < sends.length - 1) await sleep(INTRA_VARIANT_SPACING_MS);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "post failed";
    }
  }

  if (tweetIds.length === 0) {
    return { ok: false, item, error: lastError ?? "post failed" };
  }

  // 一篇内容只落 1 条 DB 记录（保持「N 篇/天」计数语义），notes 记录中英 thread 首条 id
  const primary = sends[0]!;
  const record = await createSocialOpsRecord({
    contentType: item.contentType,
    refKey: item.refKey,
    title: item.title,
    canonicalUrl: primary.url,
    xCopy: sends.map((s) => `[${s.locale}]\n${s.tweets.join("\n— — —\n")}`).join("\n\n===\n\n"),
    xhsCopy: item.xhsCopy,
    utmCampaign: item.utmCampaign,
    createdBy: "cron:x",
  });
  await updateSocialOpsRecord(record.id, {
    markPostedX: true,
    notes: `auto_post ${tweetIds.join(" ")}${lastError ? ` (partial: ${lastError})` : ""}`,
  });
  return { ok: true, item, tweetId: tweetIds.join(","), recordId: record.id };
}

/** 每日批量发深度研报英文长文到 X */
export async function runAutoPostXBatch(opts: {
  count?: number;
  dryRun?: boolean;
  spacingMs?: number;
  lang?: "zh" | "en";
  force?: boolean;
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
    const remaining = opts.force ? target : Math.max(0, target - alreadyToday);
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
      const out = await postOne(item, opts.lang);
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

/** 卡点 franchise：中英 thread 二次传播，默认每轮 2 篇 */
export async function runChokepointPostXBatch(opts: {
  count?: number;
  dryRun?: boolean;
  spacingMs?: number;
  lang?: "zh" | "en";
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

  const target = Math.max(1, Math.min(5, opts.count ?? 2));
  const spacingMs = opts.spacingMs ?? Number(process.env.X_POST_SPACING_MS ?? DEFAULT_SPACING_MS);
  const pool = await buildChokepointSocialPool(target + 5);
  const picks: SocialPoolItem[] = [];
  for (const item of pool) {
    if (await isRefPostedEver(item.refKey)) continue;
    picks.push(item);
    if (picks.length >= target) break;
  }

  if (picks.length === 0) {
    return {
      ok: true,
      action: "skipped",
      reason: "no unposted chokepoint analysis",
      target,
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
      target: picks.length,
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
    const out = await postOne(item, opts.lang);
    results.push(out);
    if (out.ok) posted++;
    else if (out.error === "already posted today") skipped++;
    else failed++;
    if (i < picks.length - 1 && spacingMs > 0 && out.ok) await sleep(spacingMs);
  }

  return {
    ok: failed === 0,
    action: failed > 0 && posted > 0 ? "partial" : "posted",
    target: picks.length,
    posted,
    failed,
    skipped,
    results,
  };
}

export type TrackRecordPostResult = {
  ok: boolean;
  action: "skipped" | "dry_run" | "posted" | "error";
  reason?: string;
  tweetIds?: string[];
  preview?: Record<string, string[]>;
};

/**
 * 战绩应验帖：用真实「评级以来 vs SPY 超额」数据发一条 thread（中/英）。
 * 每自然日最多发一次；落地 /start（Picks / Brief / Research CTA）。不喊单、不晒杠杆。
 */
export async function runTrackRecordPostX(
  opts: { dryRun?: boolean; lang?: "zh" | "en" } = {},
): Promise<TrackRecordPostResult> {
  if (!isXPostingEnabled()) {
    return { ok: true, action: "skipped", reason: "X credentials missing" };
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const refKey = `track_record_${stamp}`;
  if (!opts.dryRun) {
    const dup = await mysqlQuery<{ n: number }[]>(
      `select count(*) as n from social_ops_posts where ref_key = ? and posted_x_at >= curdate()`,
      [refKey],
    );
    if (Number(dup[0]?.n ?? 0) > 0) {
      return { ok: true, action: "skipped", reason: "already posted today" };
    }
  }

  const tr = await getTrackRecord();
  if (!isTrackRecordPresentable(tr)) {
    return {
      ok: true,
      action: "skipped",
      reason: `metrics not presentable (buyCount=${tr.buyCount}, winRate=${tr.buyWinRate?.toFixed(0) ?? "—"}, avgExcess=${tr.buyAvgExcess?.toFixed(1) ?? "—"})`,
    };
  }
  const top: TrackRecordCallLite[] = tr.topBuys
    .filter((r) => r.excessPct != null)
    .map((r) => ({
      symbol: r.symbol,
      verdict: r.verdict,
      since: r.since,
      returnPct: r.returnPct,
      spyPct: r.spyPct,
      excessPct: r.excessPct,
    }));
  if (top.length === 0) {
    return { ok: true, action: "skipped", reason: "no validated buy calls yet" };
  }

  const langs: ("en" | "zh")[] = opts.lang ? [opts.lang] : ["en", "zh"];
  const preview: Record<string, string[]> = {};
  const tweetIds: string[] = [];
  let lastError: string | null = null;
  for (let i = 0; i < langs.length; i++) {
    const locale = langs[i]!;
    const url = withUtm(X_LANDING_PATH, { source: "x", campaign: refKey, lang: locale });
    const tweets = buildTrackRecordThread({
      top,
      buyCount: tr.buyCount,
      winRate: tr.buyWinRate,
      avgExcess: tr.buyAvgExcess,
      url,
      locale,
    });
    preview[locale] = tweets;
    if (opts.dryRun || tweets.length === 0) continue;
    try {
      const { tweetIds: ids } = await postThread(tweets);
      tweetIds.push(`${locale}=${ids[0]}${ids.length > 1 ? `(+${ids.length - 1})` : ""}`);
      if (i < langs.length - 1) await sleep(INTRA_VARIANT_SPACING_MS);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "post failed";
    }
  }

  if (opts.dryRun) return { ok: true, action: "dry_run", preview };
  if (tweetIds.length === 0) return { ok: false, action: "error", reason: lastError ?? "post failed" };

  const record = await createSocialOpsRecord({
    contentType: "custom",
    refKey,
    title: "OPS ratings track record",
    canonicalUrl: withUtm(X_LANDING_PATH, { source: "x", campaign: refKey }),
    xCopy: Object.entries(preview)
      .map(([l, ts]) => `[${l}]\n${ts.join("\n— — —\n")}`)
      .join("\n\n===\n\n"),
    xhsCopy: "",
    utmCampaign: refKey,
    createdBy: "cron:x-record",
  });
  await updateSocialOpsRecord(record.id, {
    markPostedX: true,
    notes: `track_record ${tweetIds.join(" ")}${lastError ? ` (partial: ${lastError})` : ""}`,
  });
  return { ok: true, action: "posted", tweetIds };
}
