import Link from "next/link";
import { listExpiringOptionsRadar } from "@/lib/expiring-options";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export async function ExpiringOptionsRadar({
  limit = 12,
  compact = false,
  expirationDate,
  expiryLabel,
  symbol,
}: {
  limit?: number;
  compact?: boolean;
  expirationDate?: string;
  expiryLabel: string;
  symbol?: string;
}) {
  const locale = await getLocale();
  const o = getDictionary(locale).optionsPage;
  const { expirationDate: exp, rows, quotesAvailable } = await listExpiringOptionsRadar({
    expirationDate,
    underlyings: symbol ? [symbol] : undefined,
    topPerUnderlying: symbol ? 120 : undefined,
    globalLimit: symbol ? 200 : limit,
  });
  const delayed = quotesAvailable ? o.delayed.minutes15 : o.delayed.unavailable;

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{o.radar.title}</h2>
          <p className="text-[11px] text-muted">
            {fmt(o.radar.expiryFmt, { date: exp, label: expiryLabel, delayed })}
          </p>
        </div>
        {!compact ? (
          <Link
            href="/expiring-options"
            className="text-[12px] font-semibold text-accent-strong hover:underline"
          >
            {o.radar.viewAll}
          </Link>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-muted">{o.radar.empty}</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-semibold">{o.radar.colUnderlying}</th>
                <th className="px-3 py-2 font-semibold">{o.radar.colType}</th>
                <th className="px-3 py-2 font-semibold text-right">{o.radar.colStrike}</th>
                <th className="px-3 py-2 font-semibold text-right">{o.radar.colVolume}</th>
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
        {o.radar.footnote}
      </p>
    </section>
  );
}
