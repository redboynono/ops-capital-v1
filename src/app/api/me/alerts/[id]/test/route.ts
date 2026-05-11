import { NextResponse } from "next/server";

import { RULE_LABELS, listAlertsForUser } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";
import { getQuote } from "@/lib/finnhub";

/**
 * 测试发送：手动触发一条样例邮件，不写 last_triggered_at（不进入冷却期）。
 * 用于验收"提醒能正常送达邮箱"。
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;

  const alerts = await listAlertsForUser(user.id);
  const rule = alerts.find((a) => a.id === id);
  if (!rule) return NextResponse.json({ error: "alert not found" }, { status: 404 });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "邮件服务未配置（缺 RESEND_*）" }, { status: 500 });
  }

  const quote = await getQuote(rule.symbol).catch(() => null);
  const meta = RULE_LABELS[rule.rule_type];
  const isPrice = rule.rule_type.startsWith("price_");
  const thresholdLabel = isPrice
    ? `$${Number(rule.threshold).toFixed(2)}`
    : `${Number(rule.threshold).toFixed(2)}%`;
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://opscapital.com";

  const price = quote && Number.isFinite(quote.c) ? `$${quote.c.toFixed(2)}` : "—";
  const dp = quote && quote.dp != null ? `${quote.dp >= 0 ? "+" : ""}${quote.dp.toFixed(2)}%` : "—";

  const html = `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px">
      <p style="margin:0;font-size:11px;color:#9ca3af;letter-spacing:0.05em">OPS ALPHA · PRICE ALERT (TEST)</p>
      <h2 style="margin:6px 0 0;font-size:20px;color:#c2462a">[测试] ${rule.symbol} ${meta.zh}</h2>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
      这是一封 <strong>测试邮件</strong>，由你在 OPS Alpha 后台主动触发。
      实际规则：${rule.symbol} ${meta.zh} ${thresholdLabel}
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
      <tr><td style="padding:6px 0;color:#6b7280;width:40%">当前现价</td><td style="padding:6px 0;font-family:Menlo,monospace;font-weight:bold">${price}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">今日涨跌</td><td style="padding:6px 0;font-family:Menlo,monospace">${dp}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">触发条件</td><td style="padding:6px 0;font-family:Menlo,monospace;font-size:12px">${rule.rule_type} ${meta.verb} ${thresholdLabel}</td></tr>
    </table>
    <p style="margin:0"><a href="${siteUrl}/dashboard/alerts" style="display:inline-block;padding:8px 16px;background:#e15a3c;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600">前往管理</a></p>
    <p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px">
      若收到此邮件 = 邮件通道工作正常。实际规则触发不会发送本测试邮件。
    </p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: user.email,
      subject: `🧪 OPS Alpha · ${rule.symbol} 测试提醒`,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "邮件发送失败", detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, sentTo: user.email });
}
