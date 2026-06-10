/**
 * 加密六因子确定性打分（无需 AI 即可跑通）。
 *
 * 每个因子由 CoinGecko factsheet 子指标加权得到 0–100 分，再映射为 A+~F，
 * 走与股票完全相同的 GPA → quant_score 管线（docs/crypto-factor-model.md）。
 */

import { fetchCryptoFactsheet, getCoingeckoId, type CryptoFactsheet } from "@/lib/coingecko";
import {
  CRYPTO_FACTORS,
  type FactorKey,
  type Grade,
  type Verdict,
  recomputeAndStoreQuantScore,
  upsertFactorGrade,
  upsertRating,
} from "@/lib/ratings";
import {
  appendFactorGradeSnapshots,
  appendRatingSnapshot,
  resolveHistoricalGrades,
} from "@/lib/ratingsSnapshot";
import { mysqlQuery } from "@/lib/mysql";

// ---------------------------------------------------------------
// helpers
// ---------------------------------------------------------------

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** 线性映射 v∈[lo,hi] → [0,1] */
const lin = (v: number | null, lo: number, hi: number): number | null =>
  v == null ? null : clamp01((v - lo) / (hi - lo));

/** log10 比例 v∈[0,full] → [0,1] */
const logScale = (v: number | null, full: number): number | null =>
  v == null || v < 0 ? null : clamp01(Math.log10(v + 1) / Math.log10(full + 1));

/** 子指标 [score0to1, weight] 加权（忽略 null，按已用权重归一） */
function weighted(parts: Array<[number | null, number]>): number | null {
  let sum = 0;
  let used = 0;
  for (const [s, w] of parts) {
    if (s == null) continue;
    sum += s * w;
    used += w;
  }
  return used > 0 ? (sum / used) * 100 : null;
}

export function scoreToGrade(score: number | null): Grade | null {
  if (score == null) return null;
  if (score >= 95) return "A+";
  if (score >= 88) return "A";
  if (score >= 80) return "A-";
  if (score >= 72) return "B+";
  if (score >= 64) return "B";
  if (score >= 56) return "B-";
  if (score >= 48) return "C+";
  if (score >= 40) return "C";
  if (score >= 32) return "C-";
  if (score >= 24) return "D+";
  if (score >= 16) return "D";
  if (score >= 8) return "D-";
  return "F";
}

// ---------------------------------------------------------------
// 六因子打分（0–100）
// ---------------------------------------------------------------

export function scoreCryptoFactors(fs: CryptoFactsheet): Partial<Record<FactorKey, Grade>> {
  const isMeme = fs.categories.some((c) => /meme/i.test(c));

  // 估值：FDV 稀释小 + 距 ATH 回撤深 + 换手处于健康区间
  const turnover = fs.volumeToMcap; // 健康区间 0.02–0.15
  const turnoverScore =
    turnover == null ? null : turnover < 0.02 ? turnover / 0.02 : turnover <= 0.15 ? 1 : clamp01(1 - (turnover - 0.15) / 0.5);
  const valuation = weighted([
    [fs.mcapToFdv, 0.35],                                  // 1.0 = 无稀释
    [lin(fs.athChangePct == null ? null : -fs.athChangePct, 0, 80), 0.35], // 回撤 0%→0 分，-80%→满分
    [turnoverScore, 0.30],
  ]);

  // 网络与采用：开发者活动 + 社区规模 + 市值排名（采用代理）+ 公众情绪
  const community =
    fs.twitterFollowers == null && fs.redditSubscribers == null
      ? null
      : (fs.twitterFollowers ?? 0) + (fs.redditSubscribers ?? 0);
  const network = weighted([
    [logScale(fs.commits4w, 300), 0.40],
    [logScale(community, 5_000_000), 0.25],
    [fs.mcapRank == null ? null : clamp01(1 - Math.log10(fs.mcapRank) / 3), 0.20], // rank 1→1，1000→0
    [fs.sentimentUpPct == null ? null : fs.sentimentUpPct / 100, 0.15],
  ]);

  // 代币经济：硬顶 + 流通占比 + 增发余量小
  const issuanceLeft =
    fs.circulatingSupply != null && fs.totalSupply != null && fs.totalSupply > 0
      ? fs.circulatingSupply / fs.totalSupply
      : null;
  const tokenomics = weighted([
    [fs.maxSupply != null ? 1 : 0, 0.20],                  // 有硬顶
    [fs.circToMaxPct != null ? fs.circToMaxPct / 100 : fs.mcapToFdv, 0.45],
    [issuanceLeft, 0.35],
  ]);

  // 动量：30d / 200d 收益 + 相对 BTC 强弱
  const momentum = weighted([
    [lin(fs.pricePct30d, -50, 50), 0.30],
    [lin(fs.pricePct200d, -70, 70), 0.35],
    [lin(fs.pricePct30dVsBtc, -30, 30), 0.35],             // BTC 自身为 0 → 中性
  ]);

  // 流动性：成交量规模 + 上所广度 + 交易对数
  const liquidity = weighted([
    [
      fs.volume24hUsd == null || fs.volume24hUsd <= 0
        ? null
        : clamp01((Math.log10(fs.volume24hUsd) - 7) / 3.5), // $10M→0，$10B+→1
      0.50,
    ],
    [fs.exchangesCount == null ? null : clamp01(fs.exchangesCount / 30), 0.30],
    [fs.tickersCount == null ? null : clamp01(fs.tickersCount / 100), 0.20],
  ]);

  // 安全与去中心化：存续年限 + 市值地位（久经考验代理）+ 类别风险
  const security = weighted([
    [fs.ageYears == null ? null : clamp01(fs.ageYears / 10), 0.50],
    [fs.mcapRank == null ? null : clamp01(1 - Math.log10(fs.mcapRank) / 3), 0.30],
    [isMeme ? 0 : 1, 0.20],
  ]);

  const grades: Partial<Record<FactorKey, Grade>> = {};
  const put = (f: FactorKey, s: number | null) => {
    const g = scoreToGrade(s);
    if (g) grades[f] = g;
  };
  put("CRYPTO_VALUATION", valuation);
  put("NETWORK", network);
  put("TOKENOMICS", tokenomics);
  put("MOMENTUM", momentum);
  put("LIQUIDITY", liquidity);
  put("SECURITY", security);
  return grades;
}

function verdictFromScore(score: number | null): Verdict | null {
  if (score == null) return null;
  if (score >= 4.25) return "STRONG_BUY";
  if (score >= 3.5) return "BUY";
  if (score >= 2.5) return "HOLD";
  if (score >= 1.75) return "SELL";
  return "STRONG_SELL";
}

/** 主类别（industry 列复用为加密类别） */
function primaryCategory(fs: CryptoFactsheet): string {
  const preferred = ["Layer 1 (L1)", "Layer 2 (L2)", "Smart Contract Platform", "Decentralized Finance (DeFi)", "Meme"];
  for (const p of preferred) {
    const hit = fs.categories.find((c) => c === p);
    if (hit) return hit;
  }
  return fs.categories[0] ?? "Crypto";
}

// ---------------------------------------------------------------
// 端到端：拉数据 → 打分 → 入库 → 快照
// ---------------------------------------------------------------

export type CryptoRatingResult = {
  symbol: string;
  quant_score: number | null;
  verdict: Verdict | null;
  grades: Partial<Record<FactorKey, Grade>>;
  factsheet: CryptoFactsheet;
};

export async function generateAndSaveCryptoRating(
  symbol: string,
  source: "AI" | "CRON" | "MANUAL" = "AI",
): Promise<CryptoRatingResult> {
  const cgId = await getCoingeckoId(symbol);
  if (!cgId) throw new Error(`tickers.coingecko_id 缺失：${symbol}`);
  const fs = await fetchCryptoFactsheet(cgId);
  if (!fs) throw new Error(`CoinGecko 拉取失败：${cgId}（可能限流，稍后重试）`);

  // 1. 确定性六因子
  const grades = scoreCryptoFactors(fs);

  // 2. grade_3m / grade_6m 从历史快照回看
  const history = await resolveHistoricalGrades(symbol, [...CRYPTO_FACTORS]);
  for (const f of CRYPTO_FACTORS) {
    const { m3, m6 } = history[f] ?? { m3: null, m6: null };
    await upsertFactorGrade(symbol, f, { now: grades[f] ?? null, m3, m6 });
  }

  // 3. quant_score（asset_class 感知加权）
  const quant = await recomputeAndStoreQuantScore(symbol);
  const verdict = verdictFromScore(quant);

  // 4. ratings 主行（crypto 无 street_*，前端按 asset_class 隐藏）
  const notes = `量化六因子（CoinGecko 确定性打分）· FDV稀释 ${fs.mcapToFdv != null ? (fs.mcapToFdv * 100).toFixed(0) + "%" : "—"} · 距ATH ${fs.athChangePct != null ? fs.athChangePct.toFixed(0) + "%" : "—"}`;
  await upsertRating(symbol, {
    ops_verdict: verdict,
    ops_score: quant,
    industry: primaryCategory(fs),
    has_dividend: false,
    notes,
    source: source === "CRON" ? "AI" : source === "AI" ? "AI" : "MANUAL",
  });

  // 5. 历史快照 + 刷新时间
  await Promise.all([
    appendFactorGradeSnapshots(symbol, grades),
    appendRatingSnapshot(symbol, {
      ops_verdict: verdict,
      ops_score: quant,
      ops_target_price: null,
      street_verdict: null,
      street_score: null,
      street_target_price: null,
      quant_score: quant,
      rank_overall: null,
      rank_sector: null,
      rank_industry: null,
      industry: primaryCategory(fs),
      notes,
      source,
    }),
    mysqlQuery("update ticker_ratings set last_refreshed_at = now(3) where symbol = ?", [symbol]),
  ]);

  return { symbol, quant_score: quant, verdict, grades, factsheet: fs };
}
