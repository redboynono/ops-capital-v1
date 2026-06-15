"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_COOKIE = "ops_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function ensureVisitorId(): string {
  let vid = readCookie(VISITOR_COOKIE);
  if (!vid) {
    vid = crypto.randomUUID();
    document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(vid)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }
  return vid;
}

/** 轻量 page_view 埋点，支撑 DAU / UV / 路径分析 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    if (lastRef.current === path) return;
    lastRef.current = path;

    const vid = ensureVisitorId();
    const utmSource = searchParams?.get("utm_source") ?? undefined;

    void fetch("/api/analytics/ping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, visitorId: vid, utmSource }),
      keepalive: true,
    }).catch(() => null);
  }, [pathname, searchParams]);

  return null;
}
