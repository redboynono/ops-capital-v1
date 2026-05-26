import { isSubscriptionActive, type SubscriptionFields } from "@/lib/subscription";
import { getPlan, type PlanId, type ProductLine } from "@/lib/payments/plans";
import { mysqlQuery } from "@/lib/mysql";

export type UserEntitlements = {
  research: boolean;
  options: boolean;
  /** 任一产品线有效 */
  any: boolean;
};

export function entitlementsFromPlanId(planId: string): { research: boolean; options: boolean } {
  const plan = getPlan(planId);
  if (!plan) {
    if (planId === "month" || planId === "quarter" || planId === "year") {
      return { research: true, options: true };
    }
    return { research: false, options: false };
  }
  if (plan.product === "research") return { research: true, options: false };
  if (plan.product === "options") return { research: false, options: true };
  return { research: true, options: true };
}

export async function applyEntitlementsForUser(
  userId: string,
  planId: string,
): Promise<void> {
  const { research, options } = entitlementsFromPlanId(planId);
  await mysqlQuery(
    `update users
        set entitlement_research = greatest(entitlement_research, ?),
            entitlement_options = greatest(entitlement_options, ?)
      where id = ?`,
    [research ? 1 : 0, options ? 1 : 0, userId],
  );
}

export async function clearEntitlementsForUser(userId: string): Promise<void> {
  await mysqlQuery(
    `update users
        set entitlement_research = 0,
            entitlement_options = 0
      where id = ?`,
    [userId],
  );
}

type EntitlementRow = {
  subscription_status?: string | null;
  subscription_end_date?: string | null;
  subscriptionStatus?: string | null;
  subscriptionEndDate?: string | null;
  entitlement_research?: number | null;
  entitlement_options?: number | null;
};

function rowActive(row: EntitlementRow): boolean {
  return isSubscriptionActive({
    subscriptionStatus: row.subscription_status ?? row.subscriptionStatus,
    subscriptionEndDate: row.subscription_end_date ?? row.subscriptionEndDate,
  });
}

export function resolveEntitlements(row: EntitlementRow): UserEntitlements {
  const active = rowActive(row);
  let research = Number(row.entitlement_research ?? 0) === 1;
  let options = Number(row.entitlement_options ?? 0) === 1;

  // 兼容旧会员：active 但权益列未写入 → 视为 Bundle
  if (active && !research && !options) {
    research = true;
    options = true;
  }

  if (!active) {
    research = false;
    options = false;
  }

  return { research, options, any: research || options };
}

export async function getEntitlementsForUserId(userId: string): Promise<UserEntitlements> {
  const rows = await mysqlQuery<EntitlementRow[]>(
    `select subscription_status, subscription_end_date,
            entitlement_research, entitlement_options
       from users where id = ? limit 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { research: false, options: false, any: false };
  return resolveEntitlements(row);
}

export function hasResearchAccess(
  user: SubscriptionFields & {
    entitlementResearch?: boolean;
    entitlementOptions?: boolean;
  } | null,
): boolean {
  if (!user) return false;
  if (user.entitlementResearch) return true;
  return resolveEntitlements({
    subscription_status: user.subscriptionStatus,
    subscription_end_date: user.subscriptionEndDate,
    entitlement_research: user.entitlementResearch ? 1 : 0,
    entitlement_options: user.entitlementOptions ? 1 : 0,
  }).research;
}

export function hasOptionAlphaAccess(
  user: SubscriptionFields & {
    entitlementResearch?: boolean;
    entitlementOptions?: boolean;
  } | null,
): boolean {
  if (!user) return false;
  if (user.entitlementOptions) return true;
  return resolveEntitlements({
    subscription_status: user.subscriptionStatus,
    subscription_end_date: user.subscriptionEndDate,
    entitlement_research: user.entitlementResearch ? 1 : 0,
    entitlement_options: user.entitlementOptions ? 1 : 0,
  }).options;
}

export const OPTION_ALPHA_FREE_PREVIEW_SYMBOL = "SPY";
