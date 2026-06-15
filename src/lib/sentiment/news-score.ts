import type { FinnhubNewsItem } from "@/lib/finnhub";

const POSITIVE = [
  /\b(surge|soar|rally|jump|beat|exceed|upgrade|raised?|growth|record|strong|bullish|outperform|buy|profit|gain|boom|breakout)\b/i,
  /(大涨|飙升|突破|超预期|上调|利好|买入|增长|创新高)/,
];

const NEGATIVE = [
  /\b(plunge|drop|fall|miss|downgrade|cut|warning|lawsuit|weak|bearish|selloff|fraud|delay|loss|crash|slump)\b/i,
  /(大跌|暴跌|不及预期|下调|利空|卖出|亏损|调查|裁员)/,
];

/** 对单条新闻标题/摘要做 -1…+1 规则打分 */
export function scoreNewsText(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  let pos = 0;
  let neg = 0;
  for (const re of POSITIVE) if (re.test(t)) pos += 1;
  for (const re of NEGATIVE) if (re.test(t)) neg += 1;
  if (pos === 0 && neg === 0) return 0;
  return Math.max(-1, Math.min(1, (pos - neg) / Math.max(pos, neg, 1)));
}

export function scoreNewsItems(items: FinnhubNewsItem[]): {
  score: number;
  count: number;
  positive: number;
  negative: number;
} {
  if (items.length === 0) {
    return { score: 0, count: 0, positive: 0, negative: 0 };
  }
  let sum = 0;
  let positive = 0;
  let negative = 0;
  for (const item of items) {
    const s = scoreNewsText(`${item.headline} ${item.summary ?? ""}`);
    sum += s;
    if (s > 0.1) positive += 1;
    else if (s < -0.1) negative += 1;
  }
  return {
    score: sum / items.length,
    count: items.length,
    positive,
    negative,
  };
}
