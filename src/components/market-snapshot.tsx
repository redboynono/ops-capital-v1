import { getQuotes } from "@/lib/yahoo";

// Real indices via Yahoo Finance unofficial API (no key, wide coverage).
const TARGETS: { key: string; name: string; sub: string }[] = [
  { key: "^GSPC",     name: "S&P 500", sub: "标普 500" },
  { key: "^IXIC",     name: "NASDAQ",  sub: "纳斯达克综合" },
  { key: "^DJI",      name: "DJIA",    sub: "道琼斯" },
  { key: "^HSI",      name: "HSI",     sub: "恒生指数" },
  { key: "000001.SS", name: "SSE",     sub: "上证综指" },
  { key: "BTC-USD",   name: "BTC",     sub: "比特币 · USD" },
];

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

export async function MarketSnapshot() {
  const quotes = await getQuotes(TARGETS.map((t) => t.key)).catch(
    () => ({}) as Record<string, import("@/lib/yahoo").YahooQuote | null>,
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label-caps">市场快照</span>
        <span className="text-[11px] text-muted-soft">数据：Yahoo Finance · 近实时</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {TARGETS.map((t) => {
          const q = quotes[t.key];
          if (!q) {
            return (
              <div key={t.key} className="px-3 py-2">
                <div className="flex items-baseline gap-1.5">
                  <p className="font-mono text-[12px] font-bold tracking-wide text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-soft">{t.sub}</p>
                </div>
                <p className="mt-0.5 font-mono text-[15px] font-semibold text-muted-soft">—</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-soft">无数据</p>
              </div>
            );
          }
          const up = (q.dp ?? 0) >= 0;
          return (
            <div key={t.key} className="px-3 py-2">
              <div className="flex items-baseline gap-1.5">
                <p className="font-mono text-[12px] font-bold tracking-wide text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted-soft">{t.sub}</p>
              </div>
              <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">{fmtPrice(q.c)}</p>
              <p
                className={`mt-0.5 font-mono text-[11px] font-semibold ${
                  up ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
                }`}
              >
                {up ? "+" : ""}
                {(q.dp ?? 0).toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
