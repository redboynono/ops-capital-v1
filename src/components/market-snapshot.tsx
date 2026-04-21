// v1 使用 seed 数据，后续接入行情 API
type Quote = { symbol: string; name: string; price: string; change: number };

const snapshot: Quote[] = [
  { symbol: "SH000001", name: "上证综指", price: "3,182.46", change: 0.42 },
  { symbol: "HSTECH", name: "恒生科技", price: "4,015.83", change: -0.68 },
  { symbol: "NDX", name: "纳斯达克 100", price: "20,631.50", change: 1.14 },
  { symbol: "SPX", name: "标普 500", price: "5,482.17", change: 0.56 },
  { symbol: "BTC", name: "BTC/USD", price: "65,843", change: -1.27 },
  { symbol: "ETH", name: "ETH/USD", price: "3,194", change: 0.83 },
];

export function MarketSnapshot() {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label-caps">市场快照</span>
        <span className="text-[11px] text-muted-soft">数据延迟 15 分钟 · 仅供参考</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {snapshot.map((q) => {
          const up = q.change >= 0;
          return (
            <div key={q.symbol} className="px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wide text-muted">{q.name}</p>
              <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">{q.price}</p>
              <p
                className={`mt-0.5 font-mono text-[11px] font-semibold ${
                  up ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
                }`}
              >
                {up ? "+" : ""}
                {q.change.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
