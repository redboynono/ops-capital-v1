import { getCachedMarketSnapshotQuotes } from "@/lib/cached-data";
import type { Dictionary } from "@/lib/i18n";

function buildTargets(indices: Dictionary["alpha"]["indices"]) {
  return [
    { key: "^GSPC", name: "S&P 500", sub: indices.sp500 },
    { key: "^IXIC", name: "NASDAQ", sub: indices.nasdaq },
    { key: "^DJI", name: "DJIA", sub: indices.dow },
    { key: "^HSI", name: "HSI", sub: indices.hsi },
    { key: "000001.SS", name: "SSE", sub: indices.sse },
    { key: "BTC-USD", name: "BTC", sub: indices.btc },
  ];
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

export async function MarketSnapshot({ dict }: { dict: Dictionary }) {
  const a = dict.alpha;
  const TARGETS = buildTargets(a.indices);
  const quotes = await getCachedMarketSnapshotQuotes().catch(
    () => ({}) as Record<string, import("@/lib/yahoo").YahooQuote | null>,
  );

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label-caps">{a.marketSnapshot}</span>
        <span className="text-[11px] text-muted-soft">{a.liveQuotes}</span>
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
                <p className="mt-0.5 font-mono text-[11px] text-muted-soft">{a.noData}</p>
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
              <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">
                {fmtPrice(q.c)}
              </p>
              <p
                className={`mt-0.5 font-mono text-[11px] ${up ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}
              >
                {q.dp != null ? `${q.dp >= 0 ? "+" : ""}${q.dp.toFixed(2)}%` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
