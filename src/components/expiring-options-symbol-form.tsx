"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildExpiringOptionsQuery, type ExpiryWeek } from "@/lib/options-expiry";

export function ExpiringOptionsSymbolForm({
  initialSymbol = "",
  week = "this",
}: {
  initialSymbol?: string;
  week?: ExpiryWeek;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialSymbol);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = value.trim().toUpperCase().replace(/^\$/, "");
    const q = buildExpiringOptionsQuery({ week, symbol: sym || undefined });
    router.push(`/expiring-options${q}`);
  };

  const clear = () => {
    setValue("");
    router.push(`/expiring-options${buildExpiringOptionsQuery({ week })}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="min-w-[200px] flex-1">
        <span className="mb-1 block text-[11px] font-semibold text-muted">查询标的</span>
        <input
          type="text"
          name="symbol"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="例如 NVDA、TSLA、SPY"
          className="w-full rounded border border-border bg-surface px-3 py-2 font-mono text-[14px] text-foreground outline-none ring-accent/30 focus:border-accent focus:ring-2"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <button
        type="submit"
        className="rounded bg-accent px-4 py-2 text-[13px] font-bold text-white hover:bg-accent-strong"
      >
        生成策略
      </button>
      {initialSymbol ? (
        <button
          type="button"
          className="rounded border border-border px-3 py-2 text-[12px] text-muted hover:text-foreground"
          onClick={clear}
        >
          清除
        </button>
      ) : null}
    </form>
  );
}
