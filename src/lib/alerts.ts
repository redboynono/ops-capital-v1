import { randomUUID } from "node:crypto";

import { mysqlQuery } from "@/lib/mysql";
import { upsertTicker } from "@/lib/tickers";

export type AlertRuleType = "price_above" | "price_below" | "move_above" | "move_below";

export type AlertRule = {
  id: string;
  user_id: string;
  symbol: string;
  rule_type: AlertRuleType;
  threshold: number;
  is_active: number;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  ticker_name?: string | null;
  ticker_exchange?: string | null;
};

const VALID_TYPES: AlertRuleType[] = ["price_above", "price_below", "move_above", "move_below"];

export function isAlertType(t: string): t is AlertRuleType {
  return (VALID_TYPES as string[]).includes(t);
}

export async function listAlertsForUser(userId: string): Promise<AlertRule[]> {
  const rows = await mysqlQuery<AlertRule[]>(
    `select a.id, a.user_id, a.symbol, a.rule_type, a.threshold, a.is_active,
            a.cooldown_minutes, a.last_triggered_at, a.created_at, a.updated_at,
            t.name as ticker_name, t.exchange as ticker_exchange
       from alert_rules a
       left join tickers t on t.symbol = a.symbol
      where a.user_id = ?
      order by a.is_active desc, a.created_at desc`,
    [userId],
  );
  return rows.map((r) => ({ ...r, threshold: Number(r.threshold) }));
}

export async function createAlert(input: {
  userId: string;
  symbol: string;
  ruleType: AlertRuleType;
  threshold: number;
  cooldownMinutes?: number;
}): Promise<string> {
  const sym = input.symbol.toUpperCase().trim();
  if (!sym) throw new Error("symbol required");
  if (!isAlertType(input.ruleType)) throw new Error("invalid rule_type");
  if (!Number.isFinite(input.threshold)) throw new Error("threshold must be a number");
  if ((input.ruleType === "price_above" || input.ruleType === "price_below") && input.threshold <= 0)
    throw new Error("price threshold must be > 0");

  await upsertTicker(sym);
  const id = randomUUID();
  await mysqlQuery(
    `insert into alert_rules (id, user_id, symbol, rule_type, threshold, cooldown_minutes)
     values (?, ?, ?, ?, ?, ?)`,
    [id, input.userId, sym, input.ruleType, input.threshold, input.cooldownMinutes ?? 60],
  );
  return id;
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
  await mysqlQuery("delete from alert_rules where user_id = ? and id = ?", [userId, id]);
}

export async function toggleAlert(userId: string, id: string, isActive: boolean): Promise<void> {
  await mysqlQuery(
    "update alert_rules set is_active = ?, last_triggered_at = case when ? = 1 then null else last_triggered_at end where user_id = ? and id = ?",
    [isActive ? 1 : 0, isActive ? 1 : 0, userId, id],
  );
}

export const RULE_LABELS: Record<AlertRuleType, { zh: string; verb: string; unit: string }> = {
  price_above: { zh: "现价 ≥", verb: "突破上方", unit: "$" },
  price_below: { zh: "现价 ≤", verb: "跌破下方", unit: "$" },
  move_above: { zh: "今日涨幅 ≥", verb: "今日大涨", unit: "%" },
  move_below: { zh: "今日跌幅 ≥", verb: "今日大跌", unit: "%" },
};
