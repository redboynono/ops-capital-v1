import { listAllTickers } from "@/lib/tickers";
import { TickersBrowser } from "@/components/tickers-browser";

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

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Tickers</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">标的索引</h1>
        <p className="mt-1 text-[13px] text-muted">
          全市场覆盖的标的字典 · 点击任意代码进入标的聚合页
        </p>
      </header>

      <TickersBrowser tickers={tickers} exchangeLabels={exchangeLabels} />
    </div>
  );
}
