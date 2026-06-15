import Link from "next/link";
import { fmtMarketCap, fmtMoney, fmtPct, fmtRatio } from "@/lib/format-market";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { fetchTickerMarketSnapshot } from "@/lib/ticker-market-snapshot";
import { isUsEquityTicker } from "@/lib/polygon";

function StatCell({
  label,
  value,
  sub,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="label-caps text-[10px] text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-[15px] font-bold leading-tight ${valueClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 font-mono text-[11px] text-muted">{sub}</p> : null}
    </div>
  );
}

export async function TickerMarketStats({ symbol }: { symbol: string }) {
  const locale = await getLocale();
  const m = getDictionary(locale).marketStats;
  const o = getDictionary(locale).options;
  const snap = await fetchTickerMarketSnapshot(symbol);
  const changeCls =
    snap.changePct == null
      ? "text-muted"
      : snap.changePct > 0
        ? "text-[color:var(--success)]"
        : snap.changePct < 0
          ? "text-[color:var(--danger)]"
          : "text-foreground";

  const range52 =
    snap.high52 != null && snap.low52 != null
      ? `${fmtMoney(snap.low52, snap.currency)} – ${fmtMoney(snap.high52, snap.currency)}`
      : "—";

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCell
          label={m.price}
          value={fmtMoney(snap.price, snap.currency)}
          sub={snap.changePct != null ? fmtPct(snap.changePct) : undefined}
        />
        <StatCell
          label={m.change}
          value={
            snap.changeAbs != null
              ? `${snap.changeAbs >= 0 ? "+" : ""}${fmtMoney(Math.abs(snap.changeAbs), snap.currency)}`
              : "—"
          }
          sub={
            snap.prevClose != null
              ? fmt(m.prevCloseFmt, { price: fmtMoney(snap.prevClose, snap.currency) })
              : undefined
          }
          valueClass={changeCls}
        />
        <StatCell
          label={m.intraday}
          value={
            snap.dayLow != null && snap.dayHigh != null
              ? `${fmtMoney(snap.dayLow, snap.currency)} – ${fmtMoney(snap.dayHigh, snap.currency)}`
              : "—"
          }
        />
        <StatCell
          label={m.marketCap}
          value={fmtMarketCap(snap.marketCapM)}
          sub={snap.sharesM != null ? fmt(m.sharesFmt, { n: snap.sharesM.toFixed(0) }) : undefined}
        />
        <StatCell
          label={m.valuation}
          value={snap.peTtm != null ? `PE ${fmtRatio(snap.peTtm)}` : "—"}
          sub={
            snap.psTtm != null
              ? `PS ${fmtRatio(snap.psTtm)}${snap.pb != null ? ` · PB ${fmtRatio(snap.pb)}` : ""}`
              : undefined
          }
        />
        <StatCell
          label={m.week52}
          value={range52}
          sub={snap.beta != null ? `Beta ${fmtRatio(snap.beta)}` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-soft">
        {snap.ipo ? <span>{fmt(m.ipoFmt, { date: snap.ipo })}</span> : null}
        {snap.divYieldPct != null && snap.divYieldPct > 0 ? (
          <span>{fmt(m.divYieldFmt, { pct: fmtRatio(snap.divYieldPct, "%") })}</span>
        ) : null}
        <span>{fmt(m.quoteNoteFmt, { currency: snap.currency })}</span>
        {isUsEquityTicker(symbol) ? (
          <Link
            href={`/expiring-options?symbol=${symbol}&week=this#option-chain`}
            className="font-semibold text-accent-strong hover:underline"
          >
            {o.optionAlphaLink}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
