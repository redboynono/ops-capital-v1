import { isSubscriptionActive, type SubscriptionFields } from "@/lib/subscription";
import { getPlan, type PlanId, type ProductLine } from "@/lib/payments/plans";
import { mysqlQuery } from "@/lib/mysql";

export type UserEntitlements = {
  brief: boolean;
  research: boolean;
  options: boolean;
  /** 任一产品线有效 */
  any: boolean;
};

export function entitlementsFromPlanId(planId: string): {
  brief: boolean;
  research: boolean;
  options: boolean;
} {
  const plan = getPlan(planId);
  if (!plan) {
    if (planId === "month" || planId === "quarter" || planId === "year") {
      return { brief: true, research: true, options: true };
    }
    return { brief: false, research: false, options: false };
  }
  if (plan.product === "brief") return { brief: true, research: false, options: false };
  if (plan.product === "research") return { brief: true, research: true, options: false };
  if (plan.product === "options") return { brief: false, research: false, options: true };
  return { brief: true, research: true, options: true };
}

export async function applyEntitlementsForUser(
  userId: string,
  planId: string,
): Promise<void> {
  const { brief, research, options } = entitlementsFromPlanId(planId);
  await mysqlQuery(
    `update users
        set entitlement_brief = greatest(entitlement_brief, ?),
            entitlement_research = greatest(entitlement_research, ?),
            entitlement_options = greatest(entitlement_options, ?)
      where id = ?`,
    [brief ? 1 : 0, research ? 1 : 0, options ? 1 : 0, userId],
  );
}

export async function clearEntitlementsForUser(userId: string): Promise<void> {
  await mysqlQuery(
    `update users
        set entitlement_brief = 0,
            entitlement_research = 0,
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
  entitlement_brief?: number | null;
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
  let brief = Number(row.entitlement_brief ?? 0) === 1;
  let research = Number(row.entitlement_research ?? 0) === 1;
  let options = Number(row.entitlement_options ?? 0) === 1;

  if (active && !brief && !research && !options) {
    brief = true;
    research = true;
    options = true;
  }

  if (!active) {
    brief = false;
    research = false;
    options = false;
  }

  return { brief, research, options, any: brief || research || options };
}

export async function getEntitlementsForUserId(userId: string): Promise<UserEntitlements> {
  const rows = await mysqlQuery<EntitlementRow[]>(
    `select subscription_status, subscription_end_date,
            entitlement_brief, entitlement_research, entitlement_options
       from users where id = ? limit 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { brief: false, research: false, options: false, any: false };
  return resolveEntitlements(row);
}

export function hasBriefAccess(
  user: SubscriptionFields & {
    entitlementBrief?: boolean;
    entitlementResearch?: boolean;
    entitlementOptions?: boolean;
  } | null,
): boolean {
  if (!user) return false;
  if (user.entitlementBrief || user.entitlementResearch) return true;
  return resolveEntitlements({
    subscription_status: user.subscriptionStatus,
    subscription_end_date: user.subscriptionEndDate,
    entitlement_brief: user.entitlementBrief ? 1 : 0,
    entitlement_research: user.entitlementResearch ? 1 : 0,
    entitlement_options: user.entitlementOptions ? 1 : 0,
  }).brief;
}

export function hasResearchAccess(
  user: SubscriptionFields & {
    entitlementBrief?: boolean;
    entitlementResearch?: boolean;
    entitlementOptions?: boolean;
  } | null,
): boolean {
  if (!user) return false;
  if (user.entitlementResearch) return true;
  return resolveEntitlements({
    subscription_status: user.subscriptionStatus,
    subscription_end_date: user.subscriptionEndDate,
    entitlement_brief: user.entitlementBrief ? 1 : 0,
    entitlement_research: user.entitlementResearch ? 1 : 0,
    entitlement_options: user.entitlementOptions ? 1 : 0,
  }).research;
}

export function hasOptionAlphaAccess(
  user: SubscriptionFields & {
    entitlementBrief?: boolean;
    entitlementResearch?: boolean;
    entitlementOptions?: boolean;
  } | null,
): boolean {
  if (!user) return false;
  if (user.entitlementOptions) return true;
  return resolveEntitlements({
    subscription_status: user.subscriptionStatus,
    subscription_end_date: user.subscriptionEndDate,
    entitlement_brief: user.entitlementBrief ? 1 : 0,
    entitlement_research: user.entitlementResearch ? 1 : 0,
    entitlement_options: user.entitlementOptions ? 1 : 0,
  }).options;
}

export const OPTION_ALPHA_FREE_PREVIEW_SYMBOL = "SPY";
