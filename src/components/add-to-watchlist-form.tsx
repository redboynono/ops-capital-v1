"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AddToWatchlistForm() {
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = symbol.trim().toUpperCase();
    if (!clean) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/me/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: clean }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? "添加失败");
          return;
        }
        setSymbol("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "网络错误");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="输入代码，例：NVDA / BTC / 00700"
        className="w-64 rounded border border-border bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-accent"
      />
      <button type="submit" disabled={pending} className="btn-primary px-3 py-1.5 text-[12px]">
        {pending ? "添加中..." : "加入自选"}
      </button>
      {error ? <span className="text-[11px] text-[color:var(--danger)]">{error}</span> : null}
    </form>
  );
}

export function RemoveFromWatchlistButton({ symbol }: { symbol: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const remove = () => {
    startTransition(async () => {
      await fetch("/api/me/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      router.refresh();
    });
  };
  return (
    <button type="button" onClick={remove} disabled={pending} className="text-[12px] text-muted hover:text-[color:var(--danger)]">
      {pending ? "..." : "移除"}
    </button>
  );
}
