#!/usr/bin/env node
/**
 * OPS Alpha · 实时提醒检查器
 * ------------------------------------------------------------
 * 拉所有 active alert_rules，按 symbol 批量取 quote，逐条评估：
 *   - price_above: quote.c >= threshold
 *   - price_below: quote.c <= threshold
 *   - move_above:  quote.dp >= threshold (今日涨幅 ≥ X%)
 *   - move_below:  quote.dp <= -threshold (今日跌幅 ≥ X%)
 * 触发的规则：
 *   - 邮件通知用户（如 user.email_briefing_enabled 沿用同一开关 / 或专用 email_alerts_enabled，TODO）
 *   - 写 last_triggered_at；冷却期内不重复
 *
 * 用法：
 *   docker exec -w /app ops-alpha node check-alerts.mjs [--dry-run]
 */

import mysql from "mysql2/promise";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const DRY_RUN = args["dry-run"] === "true";

const MYSQL_URL = process.env.MYSQL_URL;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? process.env.FINNHUB_TOKEN ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM_EMAIL ?? "";
const SITE_URL = process.env.SITE_URL ?? "https://opscapital.com";

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");

const RULE_LABELS = {
  price_above: { zh: "突破上方", verb: "≥", unit: "$" },
  price_below: { zh: "跌破下方", verb: "≤", unit: "$" },
  move_above: { zh: "今日大涨", verb: "≥", unit: "%" },
  move_below: { zh: "今日大跌", verb: "≤ -", unit: "%" },
};

async function getQuote(symbol) {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const c = Number(j?.c ?? 0);
    if (!c) return null;
    return { c, dp: j.dp == null ? null : Number(j.dp), pc: Number(j.pc ?? 0) };
  } catch {
    return null;
  }
}

function evalRule(rule, quote) {
  const t = Number(rule.threshold);
  if (rule.rule_type === "price_above") return quote.c >= t;
  if (rule.rule_type === "price_below") return quote.c <= t;
  if (rule.rule_type === "move_above") return quote.dp != null && quote.dp >= t;
  if (rule.rule_type === "move_below") return quote.dp != null && quote.dp <= -t;
  return false;
}

function inCooldown(rule) {
  if (!rule.last_triggered_at) return false;
  const last = new Date(rule.last_triggered_at).getTime();
  const cooldown = Number(rule.cooldown_minutes ?? 60) * 60_000;
  return Date.now() - last < cooldown;
}

async function sendAlertEmail({ to, rule, quote }) {
  if (!RESEND_API_KEY || !RESEND_FROM) return false;
  const meta = RULE_LABELS[rule.rule_type] ?? RULE_LABELS.price_above;
  const isPrice = rule.rule_type.startsWith("price_");
  const thresholdLabel = isPrice
    ? `$${Number(rule.threshold).toFixed(2)}`
    : `${Number(rule.threshold).toFixed(2)}%`;
  const subject = `🔔 OPS Alpha · ${rule.symbol} ${meta.zh} ${thresholdLabel}`;

  const dpLabel =
    quote.dp == null ? "—" : `${quote.dp >= 0 ? "+" : ""}${quote.dp.toFixed(2)}%`;
  const dpColor = quote.dp == null ? "#6b7280" : quote.dp > 0 ? "#16a34a" : "#dc2626";

  const html = `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px">
      <p style="margin:0;font-size:11px;color:#9ca3af;letter-spacing:0.05em">OPS ALPHA · PRICE ALERT</p>
      <h2 style="margin:6px 0 0;font-size:20px;color:#c2462a">${rule.symbol} ${meta.zh}</h2>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
      你设置的提醒触发了：<strong>${rule.symbol}</strong> ${meta.zh} ${thresholdLabel}
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
      <tr>
        <td style="padding:6px 0;color:#6b7280;width:40%">现价</td>
        <td style="padding:6px 0;font-family:Menlo,monospace;font-weight:bold;font-size:18px">$${quote.c.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280">今日涨跌</td>
        <td style="padding:6px 0;font-family:Menlo,monospace;font-weight:bold;color:${dpColor}">${dpLabel}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280">前收</td>
        <td style="padding:6px 0;font-family:Menlo,monospace">$${quote.pc.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#6b7280">触发条件</td>
        <td style="padding:6px 0;font-family:Menlo,monospace;font-size:12px">${rule.rule_type} ${meta.verb} ${thresholdLabel}</td>
      </tr>
    </table>
    <p style="margin:0">
      <a href="${SITE_URL}/t/${encodeURIComponent(rule.symbol)}" style="display:inline-block;padding:8px 16px;background:#e15a3c;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600">查看 ${rule.symbol} 详情</a>
    </p>
    <p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px">
      这是一条 OPS Alpha 自动触发的价格提醒。冷却期 ${rule.cooldown_minutes} 分钟。<br/>
      管理或暂停：<a href="${SITE_URL}/dashboard/alerts" style="color:#9ca3af">/dashboard/alerts</a>
    </p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  return res.ok;
}

async function main() {
  const conn = await mysql.createConnection(MYSQL_URL);

  const [rules] = await conn.execute(
    `select a.id, a.user_id, a.symbol, a.rule_type, a.threshold,
            a.cooldown_minutes, a.last_triggered_at,
            u.email
       from alert_rules a
       inner join users u on u.id = a.user_id
      where a.is_active = 1
      order by a.symbol`,
  );

  console.log(`[alerts] active rules: ${rules.length}, dry=${DRY_RUN}`);
  if (rules.length === 0) {
    await conn.end();
    return;
  }

  // 按 symbol 分组，去重 + 一次拉一次
  const symbols = [...new Set(rules.map((r) => r.symbol))];
  const quotes = {};
  for (const s of symbols) {
    quotes[s] = await getQuote(s);
  }

  let triggered = 0;
  let mailed = 0;
  for (const rule of rules) {
    const q = quotes[rule.symbol];
    if (!q) {
      console.log(`  · ${rule.symbol} — no quote, skip`);
      continue;
    }
    if (inCooldown(rule)) continue;
    if (!evalRule(rule, q)) continue;

    triggered++;
    console.log(`  ! ${rule.symbol} ${rule.rule_type} ${rule.threshold} hit @ $${q.c} (${q.dp}%) for ${rule.email}`);
    if (DRY_RUN) continue;

    const ok = await sendAlertEmail({ to: rule.email, rule, quote: q });
    await conn.execute(
      "update alert_rules set last_triggered_at = current_timestamp where id = ?",
      [rule.id],
    );
    if (ok) mailed++;
  }

  console.log(`[alerts] done. triggered=${triggered}, mailed=${mailed}`);
  await conn.end();
}

main().catch((e) => {
  console.error("[alerts] FATAL:", e);
  process.exit(1);
});
