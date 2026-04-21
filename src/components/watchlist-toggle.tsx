"use client";

import { useState, useTransition } from "react";

export function WatchlistToggle({
  symbol,
  initialInWatchlist,
}: {
  symbol: string;
  initialInWatchlist: boolean;
}) {
  const [inList, setInList] = useState(initialInWatchlist);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        const method = inList ? "DELETE" : "POST";
        const res = await fetch("/api/me/watchlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? "操作失败，可能需要先登录。");
          return;
        }
        setInList(!inList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络错误");
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={inList ? "btn-outline px-3 py-1.5 text-[12px]" : "btn-primary px-3 py-1.5 text-[12px]"}
      >
        {pending ? "处理中..." : inList ? "已在自选 · 移除" : "加入自选"}
      </button>
      {error ? <span className="text-[11px] text-[color:var(--danger)]">{error}</span> : null}
    </div>
  );
}
