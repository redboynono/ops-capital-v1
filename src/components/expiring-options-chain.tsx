import Link from "next/link";
import { getUnderlying0DteData } from "@/lib/expiring-options";
import { formatOptionContractLabel } from "@/lib/option-copilot-scans";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export async function ExpiringOptionsChainTable({
  symbol,
  expirationDate,
  expiryLabel,
}: {
  symbol: string;
  expirationDate: string;
  expiryLabel: string;
}) {
  const { contracts, summary } = await getUnderlying0DteData(symbol, expirationDate);
  const sorted = [...contracts].sort((a, b) => {
    if (a.strike !== b.strike) return a.strike - b.strike;
    return a.contractType === "call" ? -1 : 1;
  });

  const spot = summary?.underlyingPrice;

  return (
    <section id="option-chain" className="card scroll-mt-24 overflow-hidden">
      <header className="border-b border-border bg-surface-muted px-4 py-3">
        <h2 className="text-[17px] font-bold text-foreground">
          完整期权链 · <span className="font-mono text-accent-strong">{symbol}</span>
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          到期 {expirationDate}（{expiryLabel}）
          {spot != null ? (
            <>
              {" "}
              · 现价 <span className="font-mono font-semibold text-foreground">${spot.toFixed(2)}</span>
            </>
          ) : null}
          {" "}
          · 共 {sorted.length} 张有成交合约
          {summary ? (
            <>
              {" "}
              · Call {fmtNum(summary.callVolume)} / Put {fmtNum(summary.putVolume)}
            </>
          ) : null}
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] text-muted">该到期日暂无成交数据。</p>
          <p className="mt-2 text-[12px] text-muted-soft">
            请尝试切换
            <Link href={`/expiring-options?symbol=${symbol}&week=next`} className="mx-1 text-accent-strong hover:underline">
              下周五
            </Link>
            或确认标的代码正确。
          </p>
        </div>
      ) : (
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2">行权价</th>
                <th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">合约</th>
                <th className="px-3 py-2 text-right">成交量</th>
                <th className="px-3 py-2 text-right">OI</th>
                <th className="px-3 py-2 text-right">Vol/OI</th>
                <th className="px-3 py-2 text-right">VWAP</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isCall = r.contractType === "call";
                const nearAtm =
                  spot != null && Math.abs(r.strike - spot) / spot <= 0.01;
                return (
                  <tr
                    key={r.contractTicker}
                    className={`border-b border-border/50 ${
                      nearAtm ? "bg-accent-soft/30" : ""
                    } ${isCall ? "bg-[color:color-mix(in_srgb,#16a34a_3%,transparent)]" : "bg-[color:color-mix(in_srgb,#dc2626_3%,transparent)]"}`}
                  >
                    <td className="px-3 py-2 font-mono font-bold text-foreground">{r.strike}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          isCall
                            ? "text-[#15803d] dark:text-[#86efac]"
                            : "text-[#b91c1c] dark:text-[#fca5a5]"
                        }`}
                      >
                        {isCall ? "C" : "P"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-foreground-soft">
                      {formatOptionContractLabel(r.expirationDate, r.strike, r.contractType)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.volume)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.openInterest)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.volumeOiRatio != null ? r.volumeOiRatio.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.vwap != null ? r.vwap.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-2 text-[10px] text-muted-soft">
        {OPTION_ALPHA.name} · 行情约 15 分钟延迟 · 高亮行为贴近现价（±1%）
      </p>
    </section>
  );
}
