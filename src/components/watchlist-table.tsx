"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toYahooSymbol } from "@/lib/yahoo";

type Verdict = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

const VERDICT_ZH: Record<Verdict, string> = {
  STRONG_BUY: "强买",
  BUY: "买入",
  HOLD: "持有",
  SELL: "卖出",
  STRONG_SELL: "强卖",
};

export type WatchlistRow = {
  symbol: string;
  name: string;
  exchange: string;
  quant_score: string | null;
  ops_verdict: Verdict | null;
  rank_overall: number | null;
};

type Quote = { c: number; dp: number | null };

export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});

  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const yahoo = rows.map((r) => toYahooSymbol(r.symbol)).join(",");
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(yahoo)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          quotes: Record<string, { c: number; dp: number | null } | null>;
        };
        if (cancelled) return;
        const map: Record<string, Quote | null> = {};
        for (const r of rows) {
          const y = toYahooSymbol(r.symbol);
          const q = data.quotes?.[y];
          map[r.symbol] = q ? { c: q.c, dp: q.dp } : null;
        }
        setQuotes(map);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[72px_1fr_72px_64px_56px_48px] gap-2 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <span>代码</span>
        <span>名称</span>
        <span className="text-right">现价</span>
        <span className="text-right">涨跌</span>
        <span className="text-right">Quant</span>
        <span className="text-right">评级</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const q = quotes[r.symbol];
          const dp = q?.dp;
          const cls = dp == null ? "flat" : dp > 0 ? "up" : dp < 0 ? "down" : "flat";
          const verdictZh = r.ops_verdict ? VERDICT_ZH[r.ops_verdict] : null;
          return (
            <li
              key={r.symbol}
              className="grid grid-cols-[72px_1fr_72px_64px_56px_48px] items-center gap-2 px-3 py-2 text-[12px]"
            >
              <Link href={`/t/${r.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                {r.symbol}
              </Link>
              <span className="truncate text-foreground-soft">{r.name}</span>
              <span className="font-mono text-right">{q ? q.c.toFixed(2) : "—"}</span>
              <span className={`font-mono text-right ${cls}`}>
                {dp == null ? "—" : `${dp >= 0 ? "+" : ""}${dp.toFixed(2)}%`}
              </span>
              <span className="font-mono text-right font-semibold">
                {r.quant_score ? Number(r.quant_score).toFixed(2) : "—"}
              </span>
              <span className="text-right text-[10px] font-semibold">
                {verdictZh ? verdictZh.slice(0, 2) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
