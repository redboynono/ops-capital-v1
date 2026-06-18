"use client";

/**
 * 前端转化漏斗打点。fire-and-forget，永不抛错。
 * 配合 /api/analytics/event（事件白名单校验）。
 */

const VISITOR_COOKIE = "ops_vid";
const UTM_COOKIE = "ops_utm";
const UTM_CAMPAIGN_COOKIE = "ops_utm_campaign";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

export type FunnelEvent =
  | "paywall_hit"
  | "pricing_view"
  | "checkout_start"
  | "email_capture";

export function trackEvent(
  type: FunnelEvent,
  extra?: { product?: string; slug?: string; planId?: string },
): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type,
        path: window.location.pathname,
        visitorId: readCookie(VISITOR_COOKIE),
        utmSource: readCookie(UTM_COOKIE),
        utmCampaign: readCookie(UTM_CAMPAIGN_COOKIE),
        ...extra,
      }),
    }).catch(() => null);
  } catch {
    /* ignore */
  }
}
