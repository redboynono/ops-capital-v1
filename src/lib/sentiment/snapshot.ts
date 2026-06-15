import {
  fetchCompanyNews,
  fetchSocialSentiment,
  type FinnhubSocialSentimentPoint,
} from "@/lib/finnhub";
import { isUsEquityTicker } from "@/lib/polygon";
import { scoreNewsItems } from "@/lib/sentiment/news-score";

export type SentimentBias = "bullish" | "neutral" | "bearish";

export type SentimentChannel = {
  source: "reddit" | "twitter" | "news";
  label: string;
  mentions: number;
  /** -1 … +1 */
  score: number;
};

export type SentimentSnapshot = {
  symbol: string;
  bias: SentimentBias;
  /** -100 … +100 */
  compositeScore: number;
  channels: SentimentChannel[];
  newsCount7d: number;
  fetchedAt: string;
  available: boolean;
};

type CacheEntry = { at: number; data: SentimentSnapshot };

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aggregateSocialPoints(points: FinnhubSocialSentimentPoint[]): {
  score: number;
  mentions: number;
} {
  if (points.length === 0) return { score: 0, mentions: 0 };
  let weighted = 0;
  let mentions = 0;
  for (const p of points) {
    const m = Math.max(0, Number(p.mention) || 0);
    if (m === 0) continue;
    const raw =
      Number.isFinite(p.score) && p.score !== 0
        ? p.score
        : (Number(p.positiveScore) || 0) - (Number(p.negativeScore) || 0);
    weighted += raw * m;
    mentions += m;
  }
  if (mentions === 0) return { score: 0, mentions: 0 };
  return { score: Math.max(-1, Math.min(1, weighted / mentions)), mentions };
}

function biasFromScore(score: number): SentimentBias {
  if (score > 0.12) return "bullish";
  if (score < -0.12) return "bearish";
  return "neutral";
}

export async function buildSentimentSnapshot(symbol: string): Promise<SentimentSnapshot> {
  const sym = symbol.trim().toUpperCase();
  const cached = CACHE.get(sym);
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.data;

  const empty: SentimentSnapshot = {
    symbol: sym,
    bias: "neutral",
    compositeScore: 0,
    channels: [],
    newsCount7d: 0,
    fetchedAt: new Date().toISOString(),
    available: false,
  };

  if (!isUsEquityTicker(sym)) {
    CACHE.set(sym, { at: now, data: empty });
    return empty;
  }

  const today = new Date();
  const past = new Date(today);
  past.setUTCDate(past.getUTCDate() - 7);
  const fromISO = isoDate(past);
  const toISO = isoDate(today);

  const [social, news] = await Promise.all([
    fetchSocialSentiment(sym, fromISO, toISO).catch(() => null),
    fetchCompanyNews(sym, fromISO, toISO, 20).catch(() => []),
  ]);

  const channels: SentimentChannel[] = [];
  const reddit = aggregateSocialPoints(social?.reddit ?? []);
  if (reddit.mentions > 0) {
    channels.push({
      source: "reddit",
      label: "Reddit",
      mentions: reddit.mentions,
      score: reddit.score,
    });
  }

  const twitter = aggregateSocialPoints(social?.twitter ?? []);
  if (twitter.mentions > 0) {
    channels.push({
      source: "twitter",
      label: "X / Twitter",
      mentions: twitter.mentions,
      score: twitter.score,
    });
  }

  const newsAgg = scoreNewsItems(news);
  if (newsAgg.count > 0) {
    channels.push({
      source: "news",
      label: "News",
      mentions: newsAgg.count,
      score: newsAgg.score,
    });
  }

  if (channels.length === 0) {
    CACHE.set(sym, { at: now, data: empty });
    return empty;
  }

  const weights: Record<SentimentChannel["source"], number> = {
    reddit: 0.35,
    twitter: 0.35,
    news: 0.3,
  };
  let composite = 0;
  let wSum = 0;
  for (const ch of channels) {
    const w = weights[ch.source];
    composite += ch.score * w;
    wSum += w;
  }
  const compositeScore = Math.round((composite / wSum) * 100);

  const snapshot: SentimentSnapshot = {
    symbol: sym,
    bias: biasFromScore(composite / wSum),
    compositeScore,
    channels,
    newsCount7d: newsAgg.count,
    fetchedAt: new Date().toISOString(),
    available: true,
  };

  CACHE.set(sym, { at: now, data: snapshot });
  return snapshot;
}
