"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import type { TickerRow } from "@/lib/tickers";

type Props = {
  tickers: TickerRow[];
  exchangeLabels: Record<string, string>;
};

export function TickersBrowser({ tickers, exchangeLabels }: Props) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const grouped = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    const filtered = q
      ? tickers.filter((t) => {
          return (
            t.symbol.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            (t.sector ?? "").toLowerCase().includes(q)
          );
        })
      : tickers;

    const map = new Map<string, TickerRow[]>();
    for (const t of filtered) {
      const arr = map.get(t.exchange) ?? [];
      arr.push(t);
      map.set(t.exchange, arr);
    }
    return { filtered, map };
  }, [tickers, deferred]);

  const total = tickers.length;
  const matched = grouped.filtered.length;

  return (
    <>
      {/* 搜索框 */}
      <div className="mb-4">
        <div className="flex h-10 items-center gap-2 rounded border border-border bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search className="h-4 w-4 text-muted" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索代码、名称或行业（如 NVDA、英伟达、Semiconductors）"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-soft outline-none"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted hover:text-foreground"
              aria-label="清除"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {query ? (
            <>
              匹配 <span className="font-mono font-bold text-accent-strong">{matched}</span> /{" "}
              {total}
            </>
          ) : (
            <>
              共 <span className="font-mono font-bold text-foreground-soft">{total}</span> 个标的
            </>
          )}
        </p>
      </div>

      {matched === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          没有匹配 "{query}" 的标的
        </div>
      ) : (
        [...grouped.map.entries()].map(([exchange, list]) => (
          <section key={exchange} className="mb-5">
            <h2 className="mb-2 text-[13px] font-bold text-foreground-soft">
              {exchangeLabels[exchange] ?? exchange}
              <span className="ml-2 font-normal text-muted">· {list.length}</span>
            </h2>
            <div className="card grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 md:grid-cols-4">
              {list.map((t) => (
                <Link
                  key={t.symbol}
                  href={`/t/${t.symbol}`}
                  className="row-hover px-3 py-2 text-[13px]"
                >
                  <p className="font-mono font-semibold text-accent-strong">{t.symbol}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{t.name}</p>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
