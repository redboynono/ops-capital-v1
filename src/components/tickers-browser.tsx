"use client";

import Link from "next/link";
import { Search, X, Globe2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useDict } from "@/components/locale-provider";
import { fmt } from "@/lib/i18n/fmt";
import type { TickerRow } from "@/lib/tickers";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";

type Props = {
  tickers: TickerRow[];
  exchangeLabels: Record<string, string>;
};

type LiveHit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  type: string;
  inDb: boolean;
};

export function TickersBrowser({ tickers, exchangeLabels }: Props) {
  const b = useDict().tickersPage.browser;
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [liveHits, setLiveHits] = useState<LiveHit[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const liveCtrlRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    const q = deferred.trim();
    if (q.length < 2 || matched > 0) {
      setLiveHits([]);
      setLiveLoading(false);
      liveCtrlRef.current?.abort();
      return;
    }
    const ctrl = new AbortController();
    liveCtrlRef.current?.abort();
    liveCtrlRef.current = ctrl;
    setLiveLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickers/lookup?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setLiveHits([]);
          return;
        }
        const data = (await res.json()) as { hits: LiveHit[] };
        setLiveHits(data.hits ?? []);
      } catch {
        /* aborted */
      } finally {
        setLiveLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [deferred, matched]);

  return (
    <>
      <div className="mb-4">
        <div className="flex h-10 items-center gap-2 rounded border border-border bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Search className="h-4 w-4 text-muted" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={b.searchPlaceholder}
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-soft outline-none"
            autoFocus
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted hover:text-foreground"
              aria-label={b.clearAria}
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          {query ? (
            <>{fmt(b.matchedFmt, { matched, total })}</>
          ) : (
            <>{fmt(b.totalFmt, { total })}</>
          )}
        </p>
      </div>

      {matched === 0 ? (
        <div className="card overflow-hidden">
          <div className="border-b border-border bg-surface-muted px-4 py-2 text-[12px] text-muted">
            <Globe2 className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-accent-strong" strokeWidth={1.8} />
            {fmt(b.unlistedFmt, { query })}
            {liveLoading ? <span className="ml-2 animate-pulse text-accent-strong">{b.liveSearching}</span> : null}
            {!liveLoading && liveHits.length > 0 ? (
              <span className="ml-2 text-accent-strong">{fmt(b.liveFoundFmt, { n: liveHits.length })}</span>
            ) : null}
          </div>

          {liveHits.length > 0 ? (
            <ul className="divide-y divide-border">
              {liveHits.map((h) => (
                <li key={h.symbol}>
                  <Link
                    href={`/t/${encodeURIComponent(normalizeInternalSymbol(h.symbol))}`}
                    className="row-hover flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="font-mono text-[13px] font-semibold text-accent-strong">
                      {h.displaySymbol || h.symbol}
                    </span>
                    <span className="flex-1 truncate text-[12px] text-foreground-soft">{h.name}</span>
                    <span className="hidden font-mono text-[10px] text-muted sm:inline">{h.type}</span>
                    {h.inDb ? (
                      <span className="badge-free">{b.inDb}</span>
                    ) : (
                      <span className="badge-premium" style={{ background: "transparent", borderStyle: "dashed" }}>
                        {b.live}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[12px] text-muted">
              {liveLoading
                ? b.globalSearching
                : query.trim().length < 2
                  ? b.minChars
                  : fmt(b.notFoundFmt, { query })}
            </p>
          )}
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
