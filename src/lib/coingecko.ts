/**
 * CoinGecko helper：单接口 /coins/{id} 拉取加密因子模型所需全部原始数据。
 *
 * 免费版（无 key）约 5-15 req/min；可选 COINGECKO_API_KEY（demo key）提升配额。
 * 因子映射见 docs/crypto-factor-model.md 第 5 节。
 */

import { mysqlQuery } from "@/lib/mysql";

export type CryptoFactsheet = {
  coingeckoId: string;
  symbol: string;            // 大写短码 BTC
  name: string;
  categories: string[];
  genesisDate: string | null; // YYYY-MM-DD
  ageYears: number | null;

  // 价格 / 估值
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  mcapRank: number | null;
  mcapToFdv: number | null;        // 流通市值/FDV，越接近 1 稀释越小
  athChangePct: number | null;     // 距 ATH 回撤（负数）
  volume24hUsd: number | null;
  volumeToMcap: number | null;     // 换手代理

  // 供应 / 代币经济
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  circToMaxPct: number | null;     // 流通/最大供应 %

  // 动量
  pricePct30d: number | null;
  pricePct200d: number | null;
  pricePct1y: number | null;
  pricePct30dVsBtc: number | null; // 相对 BTC 强弱

  // 网络 / 开发者 / 社区
  commits4w: number | null;
  stars: number | null;
  forks: number | null;
  pullsMerged: number | null;
  twitterFollowers: number | null;
  redditSubscribers: number | null;
  sentimentUpPct: number | null;

  // 流动性
  tickersCount: number | null;     // 交易对数（API 返回上限 100）
  exchangesCount: number | null;   // 去重交易所数
};

type CacheEntry = { at: number; data: CryptoFactsheet | null };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000; // 因子数据 10 分钟缓存足够

function num(v: unknown): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export type CryptoMarketRow = {
  coingeckoId: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  pct24h: number | null;
  marketCapUsd: number | null;
  mcapRank: number | null;
};

type MarketsCache = { at: number; data: CryptoMarketRow[] };
let MARKETS_CACHE: MarketsCache | null = null;
const MARKETS_TTL_MS = 60 * 1000;

/** 单次调用拉全部币的行情（排行榜页用，避免逐币打 /coins/{id}） */
export async function fetchCryptoMarkets(ids: string[]): Promise<CryptoMarketRow[]> {
  if (ids.length === 0) return [];
  const now = Date.now();
  if (MARKETS_CACHE && now - MARKETS_CACHE.at < MARKETS_TTL_MS) return MARKETS_CACHE.data;

  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd` +
    `&ids=${encodeURIComponent(ids.join(","))}&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
  const headers: Record<string, string> = { accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return MARKETS_CACHE?.data ?? [];
    const j = (await res.json()) as Array<Record<string, unknown>>;
    const data: CryptoMarketRow[] = j.map((row) => ({
      coingeckoId: String(row.id ?? ""),
      symbol: String(row.symbol ?? "").toUpperCase(),
      name: String(row.name ?? ""),
      priceUsd: num(row.current_price),
      pct24h: num(row.price_change_percentage_24h),
      marketCapUsd: num(row.market_cap),
      mcapRank: num(row.market_cap_rank),
    }));
    MARKETS_CACHE = { at: now, data };
    return data;
  } catch {
    return MARKETS_CACHE?.data ?? [];
  }
}

/** 库内短码 → coingecko id（tickers.coingecko_id，017 迁移种子） */
export async function getCoingeckoId(symbol: string): Promise<string | null> {
  const rows = await mysqlQuery<{ coingecko_id: string | null }[]>(
    "select coingecko_id from tickers where symbol = ? limit 1",
    [symbol],
  );
  return rows[0]?.coingecko_id ?? null;
}

export async function fetchCryptoFactsheet(coingeckoId: string): Promise<CryptoFactsheet | null> {
  const now = Date.now();
  const cached = CACHE.get(coingeckoId);
  if (cached && now - cached.at < TTL_MS) return cached.data;

  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}` +
    `?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false`;
  const headers: Record<string, string> = { accept: "application/json" };
  const apiKey = process.env.COINGECKO_API_KEY;
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  let data: CryptoFactsheet | null = null;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as Record<string, any>;
      const md = j.market_data ?? {};
      const dev = j.developer_data ?? {};
      const com = j.community_data ?? {};

      const mcap = num(md.market_cap?.usd);
      const fdv = num(md.fully_diluted_valuation?.usd);
      const vol = num(md.total_volume?.usd);
      const circ = num(md.circulating_supply);
      const maxS = num(md.max_supply);
      const genesis = typeof j.genesis_date === "string" ? j.genesis_date : null;

      const tickers = Array.isArray(j.tickers) ? j.tickers : [];
      const exchanges = new Set<string>();
      for (const t of tickers) {
        const name = t?.market?.name;
        if (typeof name === "string") exchanges.add(name);
      }

      data = {
        coingeckoId,
        symbol: String(j.symbol ?? "").toUpperCase(),
        name: String(j.name ?? coingeckoId),
        categories: Array.isArray(j.categories) ? j.categories.filter((c: unknown) => typeof c === "string") : [],
        genesisDate: genesis,
        ageYears: genesis ? (now - new Date(genesis).getTime()) / (365.25 * 24 * 3600 * 1000) : null,

        priceUsd: num(md.current_price?.usd),
        marketCapUsd: mcap,
        fdvUsd: fdv,
        mcapRank: num(j.market_cap_rank),
        mcapToFdv: mcap != null && fdv != null && fdv > 0 ? mcap / fdv : null,
        athChangePct: num(md.ath_change_percentage?.usd),
        volume24hUsd: vol,
        volumeToMcap: vol != null && mcap != null && mcap > 0 ? vol / mcap : null,

        circulatingSupply: circ,
        totalSupply: num(md.total_supply),
        maxSupply: maxS,
        circToMaxPct: circ != null && maxS != null && maxS > 0 ? (circ / maxS) * 100 : null,

        pricePct30d: num(md.price_change_percentage_30d),
        pricePct200d: num(md.price_change_percentage_200d),
        pricePct1y: num(md.price_change_percentage_1y),
        pricePct30dVsBtc: num(md.price_change_percentage_30d_in_currency?.btc),

        commits4w: num(dev.commit_count_4_weeks),
        stars: num(dev.stars),
        forks: num(dev.forks),
        pullsMerged: num(dev.pull_requests_merged),
        twitterFollowers: num(com.twitter_followers),
        redditSubscribers: num(com.reddit_subscribers),
        sentimentUpPct: num(j.sentiment_votes_up_percentage),

        tickersCount: tickers.length || null,
        exchangesCount: exchanges.size || null,
      };
    }
  } catch {
    data = null;
  }

  CACHE.set(coingeckoId, { at: now, data });
  return data;
}
