import Link from "next/link";
import { listExpiringOptionsRadar } from "@/lib/expiring-options";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export async function ExpiringOptionsRadar({
  limit = 12,
  compact = false,
  expirationDate,
  expiryLabel = "本周五",
  symbol,
}: {
  limit?: number;
  compact?: boolean;
  expirationDate?: string;
  expiryLabel?: string;
  symbol?: string;
}) {
  const { expirationDate: exp, rows, delayedNote } = await listExpiringOptionsRadar({
    expirationDate,
    underlyings: symbol ? [symbol] : undefined,
    topPerUnderlying: symbol ? 120 : undefined,
    globalLimit: symbol ? 200 : limit,
  });

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{OPTION_ALPHA.radarTitle}</h2>
          <p className="text-[11px] text-muted">
            到期 {exp}（{expiryLabel}）· {delayedNote}
          </p>
        </div>
        {!compact ? (
          <Link
            href="/expiring-options"
            className="text-[12px] font-semibold text-accent-strong hover:underline"
          >
            全部 →
          </Link>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-muted">
            该到期日暂无可展示的 Option Alpha 异动，请切换「下周五」或稍后再试。
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold">标的</th>
                <th className="px-3 py-2 font-semibold">类型</th>
                <th className="px-3 py-2 font-semibold text-right">行权价</th>
                <th className="px-3 py-2 font-semibold text-right">成交量</th>
                <th className="px-3 py-2 font-semibold text-right">OI</th>
                <th className="px-3 py-2 font-semibold text-right">Vol/OI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.contractTicker} className="border-b border-border/60 row-hover">
                  <td className="px-3 py-2">
                    <Link
                      href={`/t/${r.underlying}`}
                      className="font-mono font-bold text-accent-strong hover:underline"
                    >
                      {r.underlying}
                    </Link>
                    {r.underlyingPrice != null ? (
                      <span className="ml-2 font-mono text-[10px] text-muted">
                        ${r.underlyingPrice.toFixed(2)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.contractType === "call"
                          ? "text-[color:var(--success)]"
                          : "text-[color:var(--danger)]"
                      }
                    >
                      {r.contractType === "call" ? "Call" : "Put"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.strike}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(r.volume)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(r.openInterest)}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground-soft">
                    {r.volumeOiRatio != null ? r.volumeOiRatio.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="border-t border-border px-4 py-2 text-[10px] text-muted-soft">
        Vol/OI &gt; 1 通常表示当日新开仓活跃。数据仅供研究，非实时盘口。
      </p>
    </section>
  );
}
