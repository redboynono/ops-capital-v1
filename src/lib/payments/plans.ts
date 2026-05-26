/**
 * 分产品线订阅（USD · Gumroad）
 * plan_id 写入订单与 Gumroad url_params，到账后开通对应 entitlement。
 * Gumroad permalink 仍按「时长」映射 env（三档月/季/年），产品线靠 plan_id 区分。
 */

export type ProductLine = "research" | "options" | "bundle";

export type DurationKey = "month" | "quarter" | "year";

export type PlanId =
  | "research_month"
  | "research_quarter"
  | "research_year"
  | "options_month"
  | "options_quarter"
  | "options_year"
  | "bundle_month"
  | "bundle_quarter"
  | "bundle_year"
  | "month"
  | "quarter"
  | "year";

export type Plan = {
  id: PlanId;
  product: ProductLine;
  duration: DurationKey;
  name: string;
  nameZh: string;
  tagline?: string;
  amount: number;
  durationMonths: number;
  highlight?: boolean;
};

const DURATION: Record<DurationKey, { months: number; label: string }> = {
  month: { months: 1, label: "月付" },
  quarter: { months: 3, label: "季付" },
  year: { months: 12, label: "年付" },
};

function plan(
  product: ProductLine,
  duration: DurationKey,
  amount: number,
  nameZh: string,
  extra?: Partial<Plan>,
): Plan {
  const id = `${product}_${duration}` as PlanId;
  return {
    id,
    product,
    duration,
    name: `${product} ${duration}`,
    nameZh,
    amount,
    durationMonths: DURATION[duration].months,
    ...extra,
  };
}

export const PLANS: Record<PlanId, Plan> = {
  research_month: plan("research", "month", 999, "Research · 月付"),
  research_quarter: plan("research", "quarter", 2499, "Research · 季付", { tagline: "省 $5" }),
  research_year: plan("research", "year", 8799, "Research · 年付", { tagline: "省 $32" }),

  // 金额与 Gumroad 现有三档 permalink 一致（同链接不同 plan_id）；拆独立产品后可改价
  options_month: plan("options", "month", 999, "Option Alpha · 月付"),
  options_quarter: plan("options", "quarter", 2499, "Option Alpha · 季付", { tagline: "省 $5" }),
  options_year: plan("options", "year", 8799, "Option Alpha · 年付", { tagline: "省 $32" }),

  bundle_month: plan("bundle", "month", 999, "全站 Bundle · 月付"),
  bundle_quarter: plan("bundle", "quarter", 2499, "全站 Bundle · 季付", { tagline: "省 $5" }),
  bundle_year: plan("bundle", "year", 8799, "全站 Bundle · 年付", {
    tagline: "最划算",
    highlight: true,
  }),

  month: plan("bundle", "month", 999, "Legacy 月付"),
  quarter: plan("bundle", "quarter", 2499, "Legacy 季付"),
  year: plan("bundle", "year", 8799, "Legacy 年付"),
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const PRODUCT_LINES: ProductLine[] = ["research", "options", "bundle"];

export function getPlan(planId: string): Plan | null {
  return (PLANS as Record<string, Plan | undefined>)[planId] ?? null;
}

export function durationFromPlanId(planId: string): DurationKey {
  const plan = getPlan(planId);
  if (plan) return plan.duration;
  if (planId.endsWith("_year") || planId === "year") return "year";
  if (planId.endsWith("_quarter") || planId === "quarter") return "quarter";
  return "month";
}

export function plansForProduct(product: ProductLine): Plan[] {
  return (["month", "quarter", "year"] as DurationKey[]).map(
    (d) => PLANS[`${product}_${d}` as PlanId],
  );
}

export function formatYuan(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`;
}

export const PRODUCT_COPY: Record<
  ProductLine,
  { title: string; subtitle: string; bullets: string[] }
> = {
  research: {
    title: "Research Pro",
    subtitle: "可跟的精选 + 深度研报全文",
    bullets: [
      "OPS 精选：目标价 / 止损 / 完整逻辑",
      "深度研报全文 + Ask AI",
      "每日简报（站内）",
    ],
  },
  options: {
    title: "Option Alpha",
    subtitle: "临近到期期权 Copilot",
    bullets: [
      "全标的扫描 + 完整期权链",
      "Trade Idea + 收益分析器",
      "OPS 流向推荐表",
    ],
  },
  bundle: {
    title: "全站 Bundle",
    subtitle: "Research + Option Alpha",
    bullets: ["包含 Research Pro 全部权益", "包含 Option Alpha 全部权益", "适合重度用户"],
  },
};
