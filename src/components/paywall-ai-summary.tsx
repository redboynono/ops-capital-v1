"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * 付费墙顶部的「AI 一句话结论」钩子。
 * 异步从公开缓存端点拉取，不阻塞页面渲染；无结果则不显示。
 */
export function PaywallAiSummary({ slug, locale = "zh" }: { slug: string; locale?: "zh" | "en" }) {
  const en = locale === "en";
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/research/paywall-summary?slug=${encodeURIComponent(slug)}&lang=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { summary?: string | null } | null) => {
        if (!alive) return;
        setSummary(d?.summary ?? null);
      })
      .catch(() => {
        if (alive) setSummary(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug, locale]);

  if (!loading && !summary) return null;

  return (
    <div className="not-prose my-4 rounded-lg border border-accent/40 bg-accent-soft/30 p-4">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-accent-strong" strokeWidth={2} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
          {en ? "AI Take" : "AI 速读"}
        </span>
      </div>
      {loading ? (
        <div className="mt-2 space-y-1.5" aria-hidden>
          <div className="h-3 w-full animate-pulse rounded bg-foreground-soft/20" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-foreground-soft/20" />
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[14px] font-medium leading-relaxed text-foreground">{summary}</p>
          <p className="mt-1.5 text-[11px] text-muted">
            {en
              ? "Full thesis, target price, stop & position sizing below ↓"
              : "完整逻辑、目标价、止损与仓位见下方 ↓"}
          </p>
        </>
      )}
    </div>
  );
}
