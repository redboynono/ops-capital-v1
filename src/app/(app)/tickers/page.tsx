import Link from "next/link";
import { listAllTickers } from "@/lib/tickers";

export const dynamic = "force-dynamic";

const exchangeLabels: Record<string, string> = {
  NASDAQ: "美股 · NASDAQ",
  NYSE: "美股 · NYSE",
  HKEX: "港股 · HKEX",
  SSE: "A 股 · 上交所",
  SZSE: "A 股 · 深交所",
  CRYPTO: "加密资产",
  OTHER: "其他",
};

export default async function TickersIndexPage() {
  const tickers = await listAllTickers();
  const grouped = new Map<string, typeof tickers>();
  for (const t of tickers) {
    const arr = grouped.get(t.exchange) ?? [];
    arr.push(t);
    grouped.set(t.exchange, arr);
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Tickers</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">标的索引</h1>
        <p className="mt-1 text-[13px] text-muted">
          全市场覆盖的标的字典 · 点击任意代码进入标的聚合页
        </p>
      </header>

      {[...grouped.entries()].map(([exchange, list]) => (
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
      ))}
    </div>
  );
}
