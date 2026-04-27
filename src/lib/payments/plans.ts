/**
 * 预付费买断套餐目录
 * ------------------------------------------------------------
 * amount 单位为"分"（cents），与网关一致
 * 新增套餐只需在这里加一行，/pricing 页与 API 都会自动识别
 */

export type PlanId = "month" | "quarter" | "year";

export type Plan = {
  id: PlanId;
  name: string;                  // 展示名
  tagline?: string;              // 推荐标签
  amount: number;                // 金额（分）
  durationMonths: number;        // 时长（月）
  highlight?: boolean;           // UI 高亮
};

export const PLANS: Record<PlanId, Plan> = {
  month: {
    id: "month",
    name: "月度会员",
    amount: 6800,                // ¥68
    durationMonths: 1,
  },
  quarter: {
    id: "quarter",
    name: "季度会员",
    tagline: "省 ¥36",
    amount: 16800,               // ¥168
    durationMonths: 3,
  },
  year: {
    id: "year",
    name: "年度会员",
    tagline: "省 ¥228 · 最划算",
    amount: 58800,               // ¥588
    durationMonths: 12,
    highlight: true,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function getPlan(planId: string): Plan | null {
  return (PLANS as Record<string, Plan | undefined>)[planId] ?? null;
}

export function formatYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
