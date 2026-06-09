/**
 * 分产品线订阅（USD · Stripe Checkout）
 * plan_id 写入订单 metadata，Webhook 到账后开通对应 entitlement。
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

/** Stripe 订阅周期：复用 Checkout subscription 模式的 recurring 配置 */
export type StripeRecurring = {
  interval: "month" | "year";
  interval_count: number;
};

const DURATION: Record<
  DurationKey,
  { months: number; label: string; recurring: StripeRecurring }
> = {
  month: { months: 1, label: "月付", recurring: { interval: "month", interval_count: 1 } },
  quarter: { months: 3, label: "季付", recurring: { interval: "month", interval_count: 3 } },
  year: { months: 12, label: "年付", recurring: { interval: "year", interval_count: 1 } },
};

/** 新用户首次订阅赠送的免费试用天数（0 = 关闭试用） */
export const TRIAL_DAYS = 7;

export function recurringForPlan(planId: string): StripeRecurring {
  const p = getPlan(planId);
  const key: DurationKey = p ? p.duration : durationFromPlanId(planId);
  return DURATION[key].recurring;
}

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
  // 金额单位为美分，须与 Stripe Checkout line_items.unit_amount 一致。
  // 定价梯度：单线 < Bundle < 两条单线之和；季付 ~13% off，年付 ~34% off。
  research_month: plan("research", "month", 999, "Research · 月付"),
  research_quarter: plan("research", "quarter", 2599, "Research · 季付", { tagline: "省 $4 · $8.66/月" }),
  research_year: plan("research", "year", 7900, "Research · 年付", {
    tagline: "省 $41 · $6.58/月",
    highlight: true,
  }),

  options_month: plan("options", "month", 1499, "Option Alpha · 月付"),
  options_quarter: plan("options", "quarter", 3899, "Option Alpha · 季付", { tagline: "省 $6 · $13.00/月" }),
  options_year: plan("options", "year", 11900, "Option Alpha · 年付", {
    tagline: "省 $61 · $9.92/月",
    highlight: true,
  }),

  bundle_month: plan("bundle", "month", 1999, "全站 Bundle · 月付", { tagline: "比分开买省 20%" }),
  bundle_quarter: plan("bundle", "quarter", 5199, "全站 Bundle · 季付", { tagline: "省 $8 · $17.33/月" }),
  bundle_year: plan("bundle", "year", 15900, "全站 Bundle · 年付", {
    tagline: "最划算 · 省 $81 · $13.25/月",
    highlight: true,
  }),

  // Legacy 裸 plan_id（兼容旧链接）→ 指向 Bundle 当前价
  month: plan("bundle", "month", 1999, "Legacy 月付"),
  quarter: plan("bundle", "quarter", 5199, "Legacy 季付"),
  year: plan("bundle", "year", 15900, "Legacy 年付"),
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
