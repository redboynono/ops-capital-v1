"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Search } from "lucide-react";

type SearchResults = {
  tickers: { symbol: string; name: string; exchange: string }[];
  posts: { id: string; title: string; slug: string; kind: string; excerpt: string }[];
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResults | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = (await res.json()) as SearchResults;
      setData(json);
    } catch {
      setData({ tickers: [], posts: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onGlobal);
    return () => window.removeEventListener("keydown", onGlobal);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(q), 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mono hidden items-center gap-1.5 rounded border border-border px-2 py-0.5 text-[10px] text-muted hover:border-accent hover:text-accent md:flex"
        aria-label="搜索"
      >
        <Search size={12} />
        <span>SEARCH</span>
        <kbd className="ml-1 opacity-60">⌘K</kbd>
      </button>

      {open ? (
        <SearchDialog
          onClose={() => setOpen(false)}
          q={q}
          setQ={setQ}
          loading={loading}
          data={data}
          inputRef={inputRef}
        />
      ) : null}
    </>
  );
}

function SearchDialog({
  onClose,
  q,
  setQ,
  loading,
  data,
  inputRef,
}: {
  onClose: () => void;
  q: string;
  setQ: (v: string) => void;
  loading: boolean;
  data: SearchResults | null;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-[560px] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search size={16} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="标的代码 / 公司名 / 文章标题…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-soft"
          />
          {loading ? <span className="text-[10px] text-muted">…</span> : null}
          <button type="button" onClick={onClose} className="mono text-[10px] text-muted hover:text-accent">
            ESC
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-2 py-2 text-[13px]">
          {!q.trim() ? (
            <p className="px-2 py-6 text-center text-muted">输入 NVDA、腾讯 或文章关键词</p>
          ) : data && data.tickers.length === 0 && data.posts.length === 0 && !loading ? (
            <p className="px-2 py-6 text-center text-muted">无匹配结果</p>
          ) : null}

          {data && data.tickers.length > 0 ? (
            <section className="mb-3">
              <p className="label-caps mb-1 px-2 text-[10px]">标的</p>
              <ul>
                {data.tickers.map((t) => (
                  <li key={t.symbol}>
                    <Link
                      href={`/t/${t.symbol}`}
                      onClick={onClose}
                      className="row-hover flex items-center justify-between rounded px-2 py-1.5"
                    >
                      <span className="font-mono font-bold text-accent-strong">{t.symbol}</span>
                      <span className="truncate text-muted">{t.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data && data.posts.length > 0 ? (
            <section>
              <p className="label-caps mb-1 px-2 text-[10px]">文章</p>
              <ul>
                {data.posts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={p.kind === "news" ? `/news/${p.slug}` : `/analysis/${p.slug}`}
                      onClick={onClose}
                      className="row-hover block rounded px-2 py-1.5"
                    >
                      <span className="font-semibold text-foreground">{p.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">{p.excerpt}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}