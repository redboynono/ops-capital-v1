import { getQuotes } from "@/lib/finnhub";

// Map display names to Finnhub-supported tickers.
// Free tier doesn't give indices directly, so we use liquid ETF proxies.
const TARGETS: { key: string; name: string; sub: string }[] = [
  { key: "SPY",                 name: "标普 500",     sub: "SPY" },
  { key: "QQQ",                 name: "纳斯达克 100", sub: "QQQ" },
  { key: "DIA",                 name: "道琼斯",       sub: "DIA" },
  { key: "FXI",                 name: "中概大盘",     sub: "FXI" },
  { key: "BINANCE:BTCUSDT",     name: "BTC/USD",      sub: "BINANCE" },
  { key: "BINANCE:ETHUSDT",     name: "ETH/USD",      sub: "BINANCE" },
];

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

export async function MarketSnapshot() {
  const quotes = await getQuotes(TARGETS.map((t) => t.key)).catch(
    () => ({}) as Record<string, import("@/lib/finnhub").FinnhubQuote | null>,
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label-caps">市场快照</span>
        <span className="text-[11px] text-muted-soft">数据：Finnhub · 15 分钟延迟</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {TARGETS.map((t) => {
          const q = quotes[t.key];
          if (!q) {
            return (
              <div key={t.key} className="px-3 py-2">
                <p className="text-[11px] font-semibold tracking-wide text-muted">{t.name}</p>
                <p className="mt-0.5 font-mono text-[15px] font-semibold text-muted-soft">—</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-soft">无数据</p>
              </div>
            );
          }
          const up = (q.dp ?? 0) >= 0;
          return (
            <div key={t.key} className="px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted">{t.name}</p>
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
