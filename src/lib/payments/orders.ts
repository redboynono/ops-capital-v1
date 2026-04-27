import { randomBytes, randomUUID } from "node:crypto";
import { getMySqlPool, mysqlQuery } from "@/lib/mysql";
import { getPlan, type PlanId } from "@/lib/payments/plans";

export type PayChannel = "alipay" | "wechat";
export type OrderStatus = "pending" | "paid" | "failed";

export type Order = {
  id: string;
  out_trade_no: string;
  user_id: string;
  pay_channel: PayChannel;
  plan_id: string;
  amount: number;
  duration_months: number;
  status: OrderStatus;
  gateway_trade_no: string | null;
  gateway_payload: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

/**
 * 生成业务订单号。格式：OPS<yyyymmdd><hhmmss><6 位随机>
 * 长度 22，足够全局唯一，人眼可读。
 */
export function newOutTradeNo(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const ymd = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const hms = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const rnd = randomBytes(3).toString("hex").toUpperCase();
  return `OPS${ymd}${hms}${rnd}`;
}

export async function createPendingOrder(input: {
  userId: string;
  channel: PayChannel;
  planId: PlanId;
}): Promise<Order> {
  const plan = getPlan(input.planId);
  if (!plan) throw new Error(`unknown plan: ${input.planId}`);

  const id = randomUUID();
  const outTradeNo = newOutTradeNo();

  await mysqlQuery(
    `insert into orders (id, out_trade_no, user_id, pay_channel, plan_id, amount, duration_months, status)
     values (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, outTradeNo, input.userId, input.channel, plan.id, plan.amount, plan.durationMonths],
  );

  const order = await getOrderByOutTradeNo(outTradeNo);
  if (!order) throw new Error("order insert race");
  return order;
}

export async function getOrderByOutTradeNo(outTradeNo: string): Promise<Order | null> {
  const rows = await mysqlQuery<Order[]>(
    `select id, out_trade_no, user_id, pay_channel, plan_id, amount, duration_months, status,
            gateway_trade_no, gateway_payload, created_at, paid_at, updated_at
     from orders where out_trade_no = ? limit 1`,
    [outTradeNo],
  );
  return rows[0] ?? null;
}

/**
 * 原子地把订单置为 paid 并续期用户订阅。
 * - 幂等：如果订单已经是 paid，直接返回现有订单，不再重复续期（防止网关重复回调导致多次续期）
 * - 续期规则：
 *   - 若当前 subscription_end_date > now   → 新 end = end + N months
 *   - 否则（过期 / 从未订阅）               → 新 end = now + N months
 *   - 同时设置 subscription_status = 'active'
 *
 * 使用事务 + SELECT ... FOR UPDATE 行锁，避免并发回调出现双重续期。
 */
export async function applyPaymentSuccess(opts: {
  outTradeNo: string;
  gatewayTradeNo: string;
  payload: string;                 // 原始网关 JSON（用于审计）
}): Promise<{ order: Order; alreadyPaid: boolean }> {
  const pool = getMySqlPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRowsRaw] = await conn.query(
      "select * from orders where out_trade_no = ? for update",
      [opts.outTradeNo],
    );
    const order = (orderRowsRaw as Order[])[0];
    if (!order) {
      await conn.rollback();
      throw new Error(`order not found: ${opts.outTradeNo}`);
    }

    if (order.status === "paid") {
      await conn.commit();
      return { order, alreadyPaid: true };
    }

    // 1) 标记订单为 paid
    await conn.query(
      `update orders
         set status = 'paid',
             gateway_trade_no = ?,
             gateway_payload = ?,
             paid_at = now()
       where id = ?`,
      [opts.gatewayTradeNo, opts.payload, order.id],
    );

    // 2) 读取用户当前订阅（行锁）
    const [userRowsRaw] = await conn.query(
      "select subscription_end_date from users where id = ? for update",
      [order.user_id],
    );
    const userRow = (userRowsRaw as { subscription_end_date: string | null }[])[0];
    const now = new Date();
    const currentEnd = userRow?.subscription_end_date ? new Date(userRow.subscription_end_date) : null;

    const baseDate = currentEnd && currentEnd > now ? currentEnd : now;
    const newEnd = addMonths(baseDate, order.duration_months);

    await conn.query(
      `update users
         set subscription_status = 'active',
             subscription_end_date = ?
       where id = ?`,
      [formatDateTimeUTC(newEnd), order.user_id],
    );

    await conn.commit();

    const paidOrder = await getOrderByOutTradeNo(opts.outTradeNo);
    return { order: paidOrder!, alreadyPaid: false };
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 标记订单为 failed。幂等。非 paid 状态下才能落到 failed。
 */
export async function markOrderFailed(outTradeNo: string, payload?: string): Promise<void> {
  await mysqlQuery(
    `update orders
       set status = 'failed',
           gateway_payload = coalesce(?, gateway_payload)
     where out_trade_no = ? and status = 'pending'`,
    [payload ?? null, outTradeNo],
  );
}

// ─────────────────────── internals ───────────────────────

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 防御闰月溢出（例如 1/31 + 1 month → 3/3，应退回 2/28/29）
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

function formatDateTimeUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
