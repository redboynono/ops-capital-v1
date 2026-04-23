import { getQuotes } from "@/lib/finnhub";

// Map display names to Finnhub-supported tickers.
// Free tier doesn't give indices directly, so we use liquid ETF proxies.
// Finnhub 免费层不提供指数点位（^GSPC 等需要付费订阅），
// 因此改用对应 ETF 价格展示——价格是 ETF 自身报价，但涨跌幅与指数基本一致。
const TARGETS: { key: string; name: string; sub: string }[] = [
  { key: "SPY",                 name: "SPY", sub: "标普 500 ETF" },
  { key: "QQQ",                 name: "QQQ", sub: "纳指 100 ETF" },
  { key: "DIA",                 name: "DIA", sub: "道琼斯 ETF" },
  { key: "FXI",                 name: "FXI", sub: "中概大盘 ETF" },
  { key: "BINANCE:BTCUSDT",     name: "BTC", sub: "比特币 · USDT" },
  { key: "BINANCE:ETHUSDT",     name: "ETH", sub: "以太坊 · USDT" },
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
