/**
 * 订阅权益判定（全站统一）
 * active + 未过期 = Premium；过期后自动 reconcile 为 inactive。
 */

export type SubscriptionFields = {
  subscriptionStatus: string | null | undefined;
  subscriptionEndDate: string | null | undefined;
};

export function isSubscriptionActive(fields: SubscriptionFields): boolean {
  if (fields.subscriptionStatus !== "active") return false;
  if (!fields.subscriptionEndDate) return true;
  const end = new Date(fields.subscriptionEndDate);
  return !Number.isNaN(end.getTime()) && end > new Date();
}

export function subscriptionDaysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const t = new Date(endDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
}

/** 若 status=active 但已过期，写回 inactive（幂等） */
export async function reconcileExpiredSubscription(userId: string): Promise<void> {
  const { mysqlQuery } = await import("@/lib/mysql");
  await mysqlQuery(
    `update users
       set subscription_status = 'inactive'
     where id = ?
       and subscription_status = 'active'
       and subscription_end_date is not null
       and subscription_end_date <= now()`,
    [userId],
  );
}
