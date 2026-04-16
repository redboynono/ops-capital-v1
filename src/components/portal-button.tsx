"use client";

import { useState } from "react";

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpenPortal = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/stripe/create-portal", {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "打开订阅管理失败");
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      setError("未获取到 Portal 链接");
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onOpenPortal}
        disabled={loading}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:opacity-60"
      >
        {loading ? "跳转中..." : "管理订阅"}
      </button>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
