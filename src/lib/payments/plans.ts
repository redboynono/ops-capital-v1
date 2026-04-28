/**
 * Membership 套餐目录（USD，由 Gumroad 处理 Merchant of Record）
 * ------------------------------------------------------------
 * amount 单位为"美分"（cents），与 Gumroad price_cents 一致
 * 每个套餐都对应一个独立 Gumroad Membership 产品
 *   - month   $9.99/mo   → permalink raahn
 *   - quarter $24.99/3mo → permalink ffzgll
 *   - year    $87.99/yr  → permalink wkqgsn
 * 所有套餐含 1 周免费试用（Gumroad 自动处理）
 */

export type PlanId = "month" | "quarter" | "year";

export type Plan = {
  id: PlanId;
  name: string;                  // 展示名
  tagline?: string;              // 推荐标签
  amount: number;                // 金额（美分）
  durationMonths: number;        // 时长（月）
  highlight?: boolean;           // UI 高亮
};

export const PLANS: Record<PlanId, Plan> = {
  month: {
    id: "month",
    name: "Monthly",
    amount: 999,                 // $9.99
    durationMonths: 1,
  },
  quarter: {
    id: "quarter",
    name: "Quarterly",
    tagline: "Save $5",
    amount: 2499,                // $24.99（vs $29.97 monthly）
    durationMonths: 3,
  },
  year: {
    id: "year",
    name: "Yearly",
    tagline: "Save $32 · Best value",
    amount: 8799,                // $87.99（vs $119.88 monthly）
    durationMonths: 12,
    highlight: true,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function getPlan(planId: string): Plan | null {
  return (PLANS as Record<string, Plan | undefined>)[planId] ?? null;
}

/**
 * 格式化美元价格。保留向后兼容的 formatYuan 名字（避免大量 UI 重命名）。
 */
export function formatYuan(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}
