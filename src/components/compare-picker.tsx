"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";

const MAX = 4;

type Hit = {
  symbol: string;
  displaySymbol: string;
  name: string;
  inDb: boolean;
};

export function ComparePicker({ current }: { current: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  // 实时搜索（复用 /api/tickers/lookup，与 TickersBrowser 一致）
  useEffect(() => {
    if (!adding) return;
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    ctrlRef.current?.abort();
    ctrlRef.current = ctrl;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickers/lookup?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { hits: Hit[] };
          setHits(data.hits ?? []);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, adding]);

  function buildUrl(symbols: string[]) {
    const next = new URLSearchParams(sp.toString());
    if (symbols.length > 0) next.set("symbols", symbols.join(","));
    else next.delete("symbols");
    const q = next.toString();
    return q ? `/compare?${q}` : "/compare";
  }

  function add(sym: string) {
    const s = sym.toUpperCase().trim();
    if (!s) return;
    if (current.includes(s)) return;
    if (current.length >= MAX) return;
    const next = [...current, s];
    router.push(buildUrl(next));
    setAdding(false);
    setQuery("");
    setHits([]);
  }

  function remove(sym: string) {
    const next = current.filter((s) => s !== sym);
    router.push(buildUrl(next));
  }

  return (
    <div className="card mb-4 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps mr-1 text-[11px]">对比</span>

        {current.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 mono text-[12px]"
          >
            <Link href={`/t/${encodeURIComponent(s)}`} className="font-bold text-accent-strong hover:underline">
              {s}
            </Link>
            <button
              type="button"
              onClick={() => remove(s)}
              aria-label={`移除 ${s}`}
              className="text-muted hover:text-foreground"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>
          </span>
        ))}

        {current.length < MAX ? (
          adding ? (
            <div className="relative">
              <div className="flex h-8 items-center gap-1 rounded border border-accent bg-surface px-2 focus-within:ring-2 focus-within:ring-accent/30">
                <Search className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && query.trim()) {
                      add(query);
                    } else if (e.key === "Escape") {
                      setAdding(false);
                      setQuery("");
                    }
                  }}
                  placeholder="代码或名称…"
                  className="w-32 bg-transparent text-[12px] text-foreground placeholder:text-muted-soft outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setQuery("");
                  }}
                  className="text-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
              {hits.length > 0 ? (
                <ul className="absolute left-0 top-9 z-10 w-72 max-h-64 overflow-y-auto rounded border border-border bg-surface shadow-lg">
                  {hits.map((h) => (
                    <li key={h.symbol}>
                      <button
                        type="button"
                        onClick={() => add(h.symbol)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-surface-muted"
                      >
                        <span className="mono font-bold text-accent-strong">{h.displaySymbol}</span>
                        <span className="flex-1 truncate text-foreground-soft">{h.name}</span>
                        {h.inDb ? <span className="text-[10px] text-muted">已收录</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {loading && hits.length === 0 ? (
                <p className="absolute left-0 top-9 mt-1 text-[10px] text-muted">查询中…</p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded border border-dashed border-foreground-soft px-2 py-1 mono text-[11px] text-foreground-soft hover:border-accent hover:text-accent-strong"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
              添加（{current.length}/{MAX}）
            </button>
          )
        ) : (
          <span className="text-[10px] text-muted">已达上限 {MAX}</span>
        )}

        {current.length > 0 ? (
          <button
            type="button"
            onClick={() => router.push("/compare")}
            className="ml-auto text-[11px] text-muted hover:text-foreground"
          >
            清空
          </button>
        ) : null}
      </div>
    </div>
  );
}
