import { buildSocialContentPool, type SocialPoolItem } from "@/lib/social/pool";
import { createSocialOpsRecord, listSocialOpsRecords, updateSocialOpsRecord } from "@/lib/social/records";
import { isXPostingEnabled, postTweet } from "@/lib/social/x-api";

export type AutoPostXResult =
  | { ok: true; action: "skipped"; reason: string }
  | { ok: true; action: "dry_run"; item: SocialPoolItem }
  | { ok: true; action: "posted"; item: SocialPoolItem; tweetId: string; recordId: string }
  | { ok: false; error: string };

const DEFAULT_MIN_INTERVAL_HOURS = 20;
const REF_COOLDOWN_DAYS = 7;
const CTA_COOLDOWN_DAYS = 14;

function poolKey(item: SocialPoolItem): string {
  return `${item.contentType}:${item.refKey}`;
}

async function recentlyPostedGlobally(withinHours: number): Promise<boolean> {
  const rows = await listSocialOpsRecords({ limit: 50 });
  const cutoff = Date.now() - withinHours * 3600_000;
  return rows.some((r) => {
    if (!r.posted_x_at) return false;
    const t = Date.parse(r.posted_x_at.replace(" ", "T"));
    return Number.isFinite(t) && t >= cutoff;
  });
}

function postedRefKeys(rows: Awaited<ReturnType<typeof listSocialOpsRecords>>): Set<string> {
  const cutoff = Date.now() - REF_COOLDOWN_DAYS * 86_400_000;
  const ctaCutoff = Date.now() - CTA_COOLDOWN_DAYS * 86_400_000;
  const keys = new Set<string>();
  for (const r of rows) {
    if (!r.posted_x_at || !r.ref_key) continue;
    const t = Date.parse(r.posted_x_at.replace(" ", "T"));
    if (!Number.isFinite(t)) continue;
    const isCta = r.content_type === "custom" && r.ref_key === "pricing_cta";
    if (isCta && t < ctaCutoff) continue;
    if (!isCta && t < cutoff) continue;
    keys.add(`${r.content_type}:${r.ref_key}`);
  }
  return keys;
}

function pickNextItem(pool: SocialPoolItem[], blocked: Set<string>): SocialPoolItem | null {
  for (const item of pool) {
    if (blocked.has(poolKey(item))) continue;
    return item;
  }
  return null;
}

export async function runAutoPostX(opts: { dryRun?: boolean } = {}): Promise<AutoPostXResult> {
  if (!isXPostingEnabled()) {
    return { ok: true, action: "skipped", reason: "X_AUTO_POST disabled or credentials missing" };
  }

  const minHours = Number(process.env.X_POST_MIN_INTERVAL_HOURS ?? DEFAULT_MIN_INTERVAL_HOURS);
  if (await recentlyPostedGlobally(minHours)) {
    return { ok: true, action: "skipped", reason: `posted within last ${minHours}h` };
  }

  const [pool, records] = await Promise.all([buildSocialContentPool(20), listSocialOpsRecords({ limit: 200 })]);
  const blocked = postedRefKeys(records);
  const item = pickNextItem(pool, blocked);
  if (!item) {
    return { ok: true, action: "skipped", reason: "no eligible content in pool" };
  }

  if (opts.dryRun) {
    return { ok: true, action: "dry_run", item };
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
    return { ok: true, action: "posted", item, tweetId, recordId: record.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "post failed" };
  }
}
