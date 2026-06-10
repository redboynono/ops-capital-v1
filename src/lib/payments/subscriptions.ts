/**
 * Stripe 订阅 ↔ users 同步层
 * ------------------------------------------------------------
 * 订阅模式下，用户权益的真相源是 Stripe Subscription：
 *   - subscription_end_date = 当前计费周期结束（current_period_end）
 *   - 订阅 active / trialing / past_due → 视为有效（保留到周期末）
 *   - 订阅 canceled / unpaid / incomplete_expired → 立即失效，清空权益
 *
 * Webhook 各事件统一收敛到 syncSubscriptionState()，幂等可重放。
 */

import { getMySqlPool, mysqlQuery } from "@/lib/mysql";
import { applyEntitlementsForUser, clearEntitlementsForUser } from "@/lib/entitlements";
import { entitlementsFromPlanId } from "@/lib/entitlements";

/** Stripe 订阅状态中视为「仍可访问」的集合 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
/** 终止态：立即收回权益 */
const TERMINAL_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

export type SubscriptionSync = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;                 // Stripe subscription.status
  currentPeriodEnd: number | null; // unix 秒
  planId: string;
  trialing: boolean;
};

function formatDateTimeUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** 通过 stripe_customer_id 反查 user_id（invoice 事件只带 customer） */
export async function findUserIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const rows = await mysqlQuery<{ id: string }[]>(
    "select id from users where stripe_customer_id = ? limit 1",
    [customerId],
  );
  return rows[0]?.id ?? null;
}

/** 用户是否已用过免费试用 */
export async function hasUsedTrial(userId: string): Promise<boolean> {
  const rows = await mysqlQuery<{ trial_used: number }[]>(
    "select trial_used from users where id = ? limit 1",
    [userId],
  );
  return Number(rows[0]?.trial_used ?? 0) === 1;
}

/** 读取用户已有的 Stripe customer id（复用，避免重复建客户） */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const rows = await mysqlQuery<{ stripe_customer_id: string | null }[]>(
    "select stripe_customer_id from users where id = ? limit 1",
    [userId],
  );
  return rows[0]?.stripe_customer_id ?? null;
}

/**
 * 把一次订阅状态同步写回 users（事务 + 行锁，幂等）。
 * - 有效态：写 active + end=current_period_end + 关联 stripe ids + 按 plan 开权益
 * - 终止态：写 inactive + 清空权益（保留 stripe ids 供审计）
 * - trialing：额外标记 trial_used=1
 */
export async function syncSubscriptionState(s: SubscriptionSync): Promise<void> {
  const pool = getMySqlPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("select id from users where id = ? for update", [s.userId]);

    const isActive = ACTIVE_STATUSES.has(s.status);
    const isTerminal = TERMINAL_STATUSES.has(s.status);

    if (isActive) {
      const endDate =
        s.currentPeriodEnd != null
          ? formatDateTimeUTC(new Date(s.currentPeriodEnd * 1000))
          : null;
      await conn.query(
        `update users
            set subscription_status = 'active',
                subscription_end_date = ?,
                stripe_customer_id = ?,
                stripe_subscription_id = ?,
                trial_used = greatest(trial_used, ?)
          where id = ?`,
        [endDate, s.stripeCustomerId, s.stripeSubscriptionId, s.trialing ? 1 : 0, s.userId],
      );
      await conn.commit();
      // 权益按产品线增量开通（greatest，不会误关其它已购权益）
      await applyEntitlementsForUser(s.userId, s.planId);
      return;
    }

    if (isTerminal) {
      await conn.query(
        `update users
            set subscription_status = 'inactive',
                stripe_customer_id = ?,
                stripe_subscription_id = ?
          where id = ?`,
        [s.stripeCustomerId, s.stripeSubscriptionId, s.userId],
      );
      await conn.commit();
      await clearEntitlementsForUser(s.userId);
      return;
    }

    // 其它中间态（incomplete 等）：仅关联 ids，不改权益
    await conn.query(
      `update users
          set stripe_customer_id = ?, stripe_subscription_id = ?
        where id = ?`,
      [s.stripeCustomerId, s.stripeSubscriptionId, s.userId],
    );
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

/** 计算某 plan 的权益描述（供日志/调试） */
export function planEntitlementSummary(planId: string): string {
  const e = entitlementsFromPlanId(planId);
  const parts: string[] = [];
  if (e.research) parts.push("research");
  if (e.options) parts.push("options");
  return parts.join("+") || "none";
}
