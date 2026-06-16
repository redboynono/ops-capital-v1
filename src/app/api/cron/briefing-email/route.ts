import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { mysqlQuery } from "@/lib/mysql";
import { listActiveSubscribers } from "@/lib/email-subscribers";
import { isEmailConfigured, sendEmail } from "@/lib/mail";
import { logEvent } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(): Promise<boolean> {
  const h = await headers();
  const bearer = h.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  return Boolean(expected && bearer === `Bearer ${expected}`);
}

type PostRow = {
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
  excerpt_en: string | null;
  is_premium: number;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://opscapital.com").replace(/\/$/, "");

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(posts: PostRow[], en: boolean, unsubToken: string): string {
  const t = {
    heading: en ? "OPS Alpha · Daily Briefing" : "OPS Alpha · 每日简报",
    intro: en
      ? "Today's research on the desk. Tap any title for the full report."
      : "今日上桌的研报，点击标题看全文。",
    premium: en ? "Research Pro" : "Research Pro",
    cta: en ? "Unlock target price, stop & full thesis → Research Pro" : "解锁目标价、止损与完整逻辑 → Research Pro",
    ctaBtn: en ? "Start free trial" : "免费试用",
    unsub: en ? "Unsubscribe" : "退订",
  };
  const items = posts
    .map((p) => {
      const lang = en ? "en" : "zh";
      const title = esc((en && p.title_en) || p.title);
      const excerpt = esc(((en && p.excerpt_en) || p.excerpt || "").slice(0, 180));
      const tag = p.is_premium
        ? `<span style="display:inline-block;font-size:11px;color:#b08b57;border:1px solid #b08b57;border-radius:3px;padding:0 5px;margin-left:6px">${t.premium}</span>`
        : "";
      return `<div style="padding:12px 0;border-bottom:1px solid #e5e7eb">
  <a href="${BASE}/analysis/${p.slug}?lang=${lang}&utm_source=briefing&utm_medium=email" style="font-size:15px;font-weight:600;color:#111827;text-decoration:none">${title}</a>${tag}
  <p style="margin:6px 0 0;font-size:13px;color:#6b7280;line-height:1.6">${excerpt}…</p>
</div>`;
    })
    .join("\n");

  return `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0a0a0d">${t.heading}</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#6b7280">${t.intro}</p>
  ${items}
  <div style="margin-top:20px;padding:16px;background:#faf7f2;border:1px solid #e8dcc8;border-radius:6px;text-align:center">
    <p style="margin:0 0 10px;font-size:13px;color:#5c4a2e">${t.cta}</p>
    <a href="${BASE}/pricing?product=research&utm_source=briefing&utm_medium=email" style="display:inline-block;padding:10px 22px;background:#b08b57;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-size:13px">${t.ctaBtn}</a>
  </div>
  <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;text-align:center">
    <a href="${BASE}/api/unsubscribe?t=${unsubToken}" style="color:#9ca3af">${t.unsub}</a> · OPS Capital
  </p>
</div>`;
}

async function handle(): Promise<NextResponse> {
  if (!(await authorize())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 今日已发布的 analysis（含免费与付费，付费只放标题+摘要作为钩子）
  const posts = await mysqlQuery<PostRow[]>(
    `select slug, title, title_en, excerpt, excerpt_en, is_premium
       from posts
      where kind = 'analysis' and is_published = 1
        and created_at >= date_sub(current_timestamp, interval 24 hour)
      order by created_at desc
      limit 8`,
  );

  if (posts.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no posts in last 24h", sent: 0 });
  }

  const subs = await listActiveSubscribers();
  if (subs.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no subscribers", sent: 0 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "email not configured (RESEND_API_KEY)",
      wouldSend: subs.length,
      posts: posts.length,
    });
  }

  let sent = 0;
  let failed = 0;
  const subject = `OPS Alpha · ${new Date().toISOString().slice(0, 10)}`;
  // 串行发送，避免触发 Resend 速率限制（订阅量上来后可改批量 API）
  for (const s of subs) {
    const en = s.locale === "en";
    try {
      await sendEmail({
        to: s.email,
        subject,
        html: buildHtml(posts, en, s.unsubscribe_token),
      });
      sent++;
    } catch (e) {
      failed++;
      console.warn(`[briefing-email] send failed to ${s.email}:`, (e as Error).message);
    }
  }

  logEvent("briefing_email_sent", { meta: { sent, failed, posts: posts.length } });
  return NextResponse.json({ ok: true, sent, failed, posts: posts.length });
}

export async function POST() {
  return handle();
}

export async function GET() {
  return handle();
}
