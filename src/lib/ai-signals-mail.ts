import {
  getEditionById,
  getLatestPublishedEdition,
  getResearchProEmailRecipients,
  markEditionEmailSent,
  type AiSignalEditionWithSignals,
} from "@/lib/ai-signals";
import { isEmailConfigured, sendEmail } from "@/lib/mail";

const BASE = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://opscapital.com").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function buildAiSignalsEmailHtml(edition: AiSignalEditionWithSignals, en: boolean): string {
  const t = {
    heading: en ? "OPS Alpha · AI Weekly Signals" : "OPS Alpha · AI 周选",
    intro: en
      ? "Quant-screened ideas with AI reasoning — Research Pro exclusive."
      : "量化预筛 + AI 深度理由 · Research Pro 专属",
    cta: en ? "View full thesis & price targets →" : "查看完整逻辑与目标价 →",
    ctaBtn: en ? "Open AI Weekly Signals" : "打开 AI 周选",
    disclaimer: en
      ? "AI-generated research for informational purposes only. Not investment advice."
      : "AI 生成内容仅供参考，不构成投资建议。",
  };

  const items = edition.signals
    .map((s) => {
      const verdict = s.ops_verdict ?? "—";
      return `<div style="padding:14px 0;border-bottom:1px solid #e5e7eb">
  <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">#${s.rank_no} · ${esc(s.ticker_symbol)}</p>
  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111827">${esc(s.headline)}</p>
  <p style="margin:6px 0 0;font-size:13px;color:#6b7280;line-height:1.6">${esc(s.reason_teaser)}</p>
  <p style="margin:8px 0 0;font-size:12px;color:#374151">
    OPS ${esc(verdict)} · ${s.ops_score?.toFixed(2) ?? "—"} · Target ${fmtPrice(s.target_price)} · Stop ${fmtPrice(s.stop_price)}
  </p>
</div>`;
    })
    .join("\n");

  const week = edition.edition_date.slice(0, 10);
  const lang = en ? "en" : "zh";

  return `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 4px;font-size:18px">${t.heading}</h2>
  <p style="margin:0 0 4px;font-size:12px;color:#9ca3af">${week}</p>
  <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${t.intro}</p>
  ${items}
  <div style="margin-top:20px;padding:16px;background:#faf7f2;border:1px solid #e8dcc8;border-radius:6px;text-align:center">
    <p style="margin:0 0 10px;font-size:13px;color:#5c4a2e">${t.cta}</p>
    <a href="${BASE}/signals?week=${week}&lang=${lang}&utm_source=ai_signals&utm_medium=email" style="display:inline-block;padding:10px 22px;background:#b08b57;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px">${t.ctaBtn}</a>
  </div>
  <p style="margin:20px 0 0;font-size:10px;color:#9ca3af;line-height:1.5">${t.disclaimer} · OPS Capital</p>
</div>`;
}

export type SendEditionEmailResult = {
  ok: boolean;
  skipped?: string;
  sent: number;
  failed: number;
  editionId?: string;
  wouldSend?: number;
};

/** 向 Research Pro 会员发送指定或最新已发布周选邮件 */
export async function sendEditionEmails(opts?: {
  editionId?: string;
  force?: boolean;
}): Promise<SendEditionEmailResult> {
  let edition = opts?.editionId
    ? await getEditionById(opts.editionId)
    : await getLatestPublishedEdition();

  if (!edition || edition.status !== "published") {
    return { ok: true, skipped: "no published edition", sent: 0, failed: 0 };
  }
  if (edition.email_sent_at && !opts?.force) {
    return { ok: true, skipped: "email already sent", sent: 0, failed: 0, editionId: edition.id };
  }
  if (edition.signals.length === 0) {
    return { ok: true, skipped: "no signals", sent: 0, failed: 0, editionId: edition.id };
  }

  const recipients = await getResearchProEmailRecipients();
  if (recipients.length === 0) {
    return { ok: true, skipped: "no research pro recipients", sent: 0, failed: 0, editionId: edition.id };
  }

  if (!isEmailConfigured()) {
    return {
      ok: true,
      skipped: "email not configured",
      sent: 0,
      failed: 0,
      wouldSend: recipients.length,
      editionId: edition.id,
    };
  }

  let sent = 0;
  let failed = 0;
  const week = edition.edition_date.slice(0, 10);
  const subject = `OPS Alpha · AI Weekly · ${week}`;

  for (const r of recipients) {
    const en = r.locale === "en";
    try {
      await sendEmail({
        to: r.email,
        subject,
        html: buildAiSignalsEmailHtml(edition, en),
      });
      sent++;
    } catch (e) {
      failed++;
      console.warn(`[ai-signals-email] failed ${r.email}:`, (e as Error).message);
    }
  }

  if (sent > 0) {
    await markEditionEmailSent(edition.id);
  }

  return { ok: true, sent, failed, editionId: edition.id };
}
