import Link from "next/link";
import { getUnderlying0DteData } from "@/lib/expiring-options";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
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
  const locale = await getLocale();
  const c = getDictionary(locale).optionsPage.chain;
  const { contracts, summary } = await getUnderlying0DteData(symbol, expirationDate);
  const sorted = [...contracts].sort((a, b) => {
    if (a.strike !== b.strike) return a.strike - b.strike;
    return a.contractType === "call" ? -1 : 1;
  });

  const spot = summary?.underlyingPrice;
  const meta =
    spot != null
      ? fmt(c.metaFmt, {
          date: expirationDate,
          label: expiryLabel,
          spot: spot.toFixed(2),
          count: sorted.length,
          callVol: fmtNum(summary!.callVolume),
          putVol: fmtNum(summary!.putVolume),
        })
      : fmt(c.metaNoSpotFmt, {
          date: expirationDate,
          label: expiryLabel,
          count: sorted.length,
          callVol: summary ? fmtNum(summary.callVolume) : "0",
          putVol: summary ? fmtNum(summary.putVolume) : "0",
        });

  return (
    <section id="option-chain" className="card scroll-mt-24 overflow-hidden">
      <header className="border-b border-border bg-surface-muted px-4 py-3">
        <h2 className="text-[17px] font-bold text-foreground">
          {fmt(c.titleFmt, { symbol })}
        </h2>
        <p className="mt-1 text-[12px] text-muted">{meta}</p>
      </header>

      {sorted.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] text-muted">{c.empty}</p>
          <p className="mt-2 text-[12px] text-muted-soft">
            {c.emptyHint}
            <Link
              href={`/expiring-options?symbol=${symbol}&week=next`}
              className="mx-1 text-accent-strong hover:underline"
            >
              {c.emptyHintLink}
            </Link>
            {c.emptyHintEnd}
          </p>
        </div>
      ) : (
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-surface-muted">
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{c.colStrike}</th>
                <th className="px-3 py-2">{c.colType}</th>
                <th className="px-3 py-2">{c.colContract}</th>
                <th className="px-3 py-2 text-right">{c.colVolume}</th>
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
        {fmt(c.footnoteFmt, { brand: OPTION_ALPHA.name })}
      </p>
    </section>
  );
}
