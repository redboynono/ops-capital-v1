import {
  fetchOptionsSnapshotForUnderlying,
  todayIsoDate,
  type PolygonOptionSnapshot,
} from "@/lib/polygon";

/** Liquid underlyings with active 0DTE / near-dated options. */
export const ZERO_DTE_WATCHLIST = [
  "SPY",
  "QQQ",
  "IWM",
  "NVDA",
  "TSLA",
  "AAPL",
  "MSFT",
  "AMD",
  "META",
  "AMZN",
  "GOOGL",
  "AVGO",
] as const;

export type ExpiringOptionHighlight = PolygonOptionSnapshot & {
  volumeOiRatio: number | null;
};

export type Underlying0DteSummary = {
  underlying: string;
  underlyingPrice: number | null;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  bias: "bullish" | "bearish" | "neutral";
  topCall: ExpiringOptionHighlight | null;
  topPut: ExpiringOptionHighlight | null;
};

type CacheEntry = {
  at: number;
  rows: ExpiringOptionHighlight[];
  summaries: Underlying0DteSummary[];
  byUnderlying: Record<string, ExpiringOptionHighlight[]>;
};

const BIAS_RATIO = 1.25;

function summarizeUnderlying(
  underlying: string,
  contracts: ExpiringOptionHighlight[],
): Underlying0DteSummary | null {
  if (contracts.length === 0) return null;
  let callVolume = 0;
  let putVolume = 0;
  let topCall: ExpiringOptionHighlight | null = null;
  let topPut: ExpiringOptionHighlight | null = null;
  let underlyingPrice: number | null = null;

  for (const c of contracts) {
    underlyingPrice ??= c.underlyingPrice;
    if (c.contractType === "call") {
      callVolume += c.volume;
      if (!topCall || c.volume > topCall.volume) topCall = c;
    } else {
      putVolume += c.volume;
      if (!topPut || c.volume > topPut.volume) topPut = c;
    }
  }

  let bias: Underlying0DteSummary["bias"] = "neutral";
  if (callVolume >= putVolume * BIAS_RATIO) bias = "bullish";
  else if (putVolume >= callVolume * BIAS_RATIO) bias = "bearish";

  return {
    underlying,
    underlyingPrice,
    callVolume,
    putVolume,
    totalVolume: callVolume + putVolume,
    bias,
    topCall,
    topPut,
  };
}

let CACHE: CacheEntry | null = null;
const TTL_MS = 5 * 60 * 1000;

function volumeOiRatio(volume: number, oi: number): number | null {
  if (oi <= 0) return volume > 0 ? volume : null;
  return volume / oi;
}

export async function listExpiringOptionsRadar(opts?: {
  expirationDate?: string;
  underlyings?: string[];
  topPerUnderlying?: number;
  globalLimit?: number;
}): Promise<{
  expirationDate: string;
  rows: ExpiringOptionHighlight[];
  summaries: Underlying0DteSummary[];
  byUnderlying: Record<string, ExpiringOptionHighlight[]>;
  fetchedAt: string;
  delayedNote: string;
}> {
  const expirationDate = opts?.expirationDate ?? todayIsoDate();
  const underlyings = opts?.underlyings ?? [...ZERO_DTE_WATCHLIST];
  const topPer = opts?.topPerUnderlying ?? 8;
  const globalLimit = opts?.globalLimit ?? 40;
  const now = Date.now();

  if (CACHE && now - CACHE.at < TTL_MS && CACHE.rows.length > 0) {
    return {
      expirationDate,
      rows: CACHE.rows.slice(0, globalLimit),
      summaries: CACHE.summaries,
      byUnderlying: CACHE.byUnderlying,
      fetchedAt: new Date(CACHE.at).toISOString(),
      delayedNote: "约 15 分钟延迟",
    };
  }

  if (!process.env.POLYGON_API_KEY) {
    return {
      expirationDate,
      rows: [],
      summaries: [],
      byUnderlying: {},
      fetchedAt: new Date().toISOString(),
      delayedNote: "行情暂不可用",
    };
  }

  const batches = await Promise.all(
    underlyings.map(async (u) => {
      try {
        const snaps = await fetchOptionsSnapshotForUnderlying(u, expirationDate, 250);
        const enriched = snaps
          .filter((s) => s.volume > 0 || s.openInterest > 0)
          .map(
            (s) =>
              ({
                ...s,
                volumeOiRatio: volumeOiRatio(s.volume, s.openInterest),
              }) satisfies ExpiringOptionHighlight,
          );
        const summary = summarizeUnderlying(u, enriched);
        const forRadar = [...enriched].sort((a, b) => b.volume - a.volume).slice(0, topPer);
        return { underlying: u, summary, enriched, forRadar };
      } catch {
        return {
          underlying: u,
          summary: null as Underlying0DteSummary | null,
          enriched: [] as ExpiringOptionHighlight[],
          forRadar: [] as ExpiringOptionHighlight[],
        };
      }
    }),
  );

  const byUnderlying: Record<string, ExpiringOptionHighlight[]> = {};
  for (const b of batches) {
    if (b.enriched.length > 0) byUnderlying[b.underlying] = b.enriched;
  }

  const summaries = batches
    .map((b) => b.summary)
    .filter((s): s is Underlying0DteSummary => s != null && s.totalVolume > 0)
    .sort((a, b) => b.totalVolume - a.totalVolume);

  const merged = batches
    .flatMap((b) => b.forRadar)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, globalLimit);

  CACHE = { at: now, rows: merged, summaries, byUnderlying };

  return {
    expirationDate,
    rows: merged,
    summaries,
    byUnderlying,
    fetchedAt: new Date(now).toISOString(),
    delayedNote: "约 15 分钟延迟",
  };
}
