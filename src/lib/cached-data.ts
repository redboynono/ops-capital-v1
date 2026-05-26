import { unstable_cache } from "next/cache";
import { getQuotes } from "@/lib/quotes";
import { listPostSectors, listPosts, type PostKind, type PostPeriod } from "@/lib/posts";
import { listRecentRatingChanges } from "@/lib/rating-changes";

const MARKET_SNAPSHOT_KEYS = [
  "^GSPC",
  "^IXIC",
  "^DJI",
  "^HSI",
  "000001.SS",
  "BTC-USD",
] as const;

/** 公开文章列表 — 跨请求缓存 2 分钟 */
export function getCachedPosts(
  opts: {
    kind?: PostKind;
    limit?: number;
    symbol?: string;
    sector?: string;
    period?: PostPeriod;
  } = {},
) {
  const kind = opts.kind ?? "";
  const limit = String(opts.limit ?? 0);
  const symbol = opts.symbol ?? "";
  const sector = opts.sector ?? "";
  const period = opts.period ?? "";

  const isDefaultFeed =
    !symbol && !sector && !period && limit !== "0";
  const revalidate =
    isDefaultFeed && (kind === "analysis" || kind === "news") ? 180 : 120;

  return unstable_cache(async () => listPosts(opts), ["posts", kind, limit, symbol, sector, period], {
    revalidate,
    tags: ["posts"],
  })();
}

/** 研报列表默认 feed（最近 40 篇，无筛选） */
export function getCachedAnalysisFeed() {
  return getCachedPosts({ kind: "analysis", limit: 40 });
}

/** 快讯列表默认 feed（最近 50 条，无筛选） */
export function getCachedNewsFeed() {
  return getCachedPosts({ kind: "news", limit: 50 });
}

/** 首页市场快照 — 跨请求缓存 90 秒 */
export function getCachedMarketSnapshotQuotes() {
  return unstable_cache(
    async () => getQuotes([...MARKET_SNAPSHOT_KEYS], 90_000),
    ["market-snapshot"],
    { revalidate: 90, tags: ["quotes"] },
  )();
}

export function getCachedPostSectors() {
  return unstable_cache(async () => listPostSectors(), ["post-sectors"], {
    revalidate: 300,
    tags: ["posts"],
  })();
}

/** 评级变动面板 — 跨请求缓存 3 分钟 */
export function getCachedRatingChanges(sinceHours: number, limit: number) {
  return unstable_cache(
    async () => listRecentRatingChanges({ sinceHours, limit }),
    ["rating-changes", String(sinceHours), String(limit)],
    { revalidate: 180, tags: ["ratings"] },
  )();
}
