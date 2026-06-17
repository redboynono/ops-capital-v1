import Link from "next/link";
import { ShareButton } from "@/components/share/share-button";
import { computeManyPerformance, computePortfolio, listPublishedPicks, type Pick, type PickPerformance } from "@/lib/picks";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Dictionary } from "@/lib/i18n/zh";

export const dynamic = "force-dynamic";

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toISOString().slice(0, 10);
}

function convictionBadge(c: Pick["conviction"], p: Dictionary["picks"]) {
  const map = {
    high: { label: p.conviction.high, cls: "text-[color:var(--success)] border-[color:var(--success)]" },
    medium: { label: p.conviction.medium, cls: "text-foreground-soft border-border" },
    low: { label: p.conviction.low, cls: "text-muted border-border" },
  };
  const m = map[c] ?? map.medium;
  return (
    <span className={`mono rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function returnClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted";
  if (pct > 0) return "text-[color:var(--success)]";
  if (pct < 0) return "text-[color:var(--danger)]";
  return "text-foreground-soft";
}

function OpenCard({ pick, perf, p }: { pick: Pick; perf: PickPerformance; p: Dictionary["picks"] }) {
  const href = `/picks/${pick.slug}`;
  return (
    <div className="card relative block p-4 transition hover:border-accent hover:-translate-y-0.5">
      {/* Share button sits above the stretched link */}
      <div className="absolute right-2 top-2 z-10">
        <ShareButton
          variant="icon-compact"
          data={{
            type: "pick",
            symbol: pick.ticker_symbol,
            title: pick.title,
            subtitle: pick.subtitle,
            conviction: pick.conviction,
            status: pick.status,
            unrealizedPct: perf.unrealizedPct,
            realizedPct: perf.realizedPct,
            entryPrice: pick.entry_price,
            entryDate: new Date(pick.entry_date).toISOString().slice(0, 10),
            targetPrice: pick.target_price,
            stopPrice: pick.stop_price,
            currentPrice: perf.currentPrice,
          }}
          urlPath={href}
          fileNamePrefix={`ops_picks_${pick.ticker_symbol}`}
        />
      </div>

      {/* Stretched link covers the card (minus share button area) */}
      <Link href={href} className="absolute inset-0 z-0" aria-label={pick.title} />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[16px] font-bold text-accent-strong">{pick.ticker_symbol}</span>
            {convictionBadge(pick.conviction, p)}
            {pick.is_premium ? <span className="badge-premium">PRO</span> : null}
          </div>
          <h3 className="mt-1 text-[15px] font-bold leading-tight text-foreground">{pick.title}</h3>
          {pick.subtitle ? (
            <p className="mt-0.5 text-[11px] text-muted">{pick.subtitle}</p>
          ) : null}
        </div>
        <div className={`mr-7 text-right font-mono text-[20px] font-bold ${returnClass(perf.unrealizedPct)}`}>
          {fmtPct(perf.unrealizedPct)}
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 text-[11px]">
        <div>
          <p className="label-caps text-[9px]">{p.entry}</p>
          <p className="mt-0.5 font-mono font-semibold">{fmtPrice(pick.entry_price)}</p>
          <p className="font-mono text-[9px] text-muted">{fmtDate(pick.entry_date)}</p>
        </div>
        <div>
          <p className="label-caps text-[9px]">{p.current}</p>
          <p className="mt-0.5 font-mono font-semibold">{fmtPrice(perf.currentPrice)}</p>
          <p className="font-mono text-[9px] text-muted">{fmt(p.heldFmt, { n: perf.daysHeld })}</p>
        </div>
        <div>
          <p className="label-caps text-[9px]">{p.target}</p>
          <p className="mt-0.5 font-mono font-semibold">{fmtPrice(pick.target_price)}</p>
          {pick.target_price && perf.currentPrice ? (
            <p className="font-mono text-[9px] text-muted">
              +{(((pick.target_price - perf.currentPrice) / perf.currentPrice) * 100).toFixed(1)}%
            </p>
          ) : null}
        </div>
        <div>
          <p className="label-caps text-[9px]">{p.stop}</p>
          <p className="mt-0.5 font-mono font-semibold text-[color:var(--danger)]">
            {fmtPrice(pick.stop_price)}
          </p>
          <p className="font-mono text-[9px] text-muted">{pick.horizon_months}M</p>
        </div>
      </div>
    </div>
  );
}

function ClosedRow({ pick, perf, p }: { pick: Pick; perf: PickPerformance; p: Dictionary["picks"] }) {
  return (
    <Link
      href={`/picks/${pick.slug}`}
      className="row-hover grid grid-cols-[80px_1fr_90px_90px_90px_90px] items-center gap-3 px-3 py-2 text-[12px]"
    >
      <span className="font-mono font-bold text-accent-strong">{pick.ticker_symbol}</span>
      <span className="truncate text-foreground-soft">{pick.title}</span>
      <span className="font-mono text-right">{fmtDate(pick.entry_date)}</span>
      <span className="font-mono text-right">{fmtDate(pick.close_date)}</span>
      <span className="font-mono text-right text-muted">{perf.daysHeld}D</span>
      <span className={`font-mono text-right font-bold ${returnClass(perf.realizedPct)}`}>
        {fmtPct(perf.realizedPct)}
      </span>
    </Link>
  );
}

export default async function PicksPage() {
  const locale = await getLocale();
  const p = getDictionary(locale).picks;
  const all = await listPublishedPicks();
  const perfMap = await computeManyPerformance(all);
  const summary = await computePortfolio(all);

  const open = all.filter((p) => p.status === "open");
  const closed = all.filter((p) => p.status !== "open");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      {/* Hero header */}
      <header className="mb-5 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="label-caps">{p.label}</span>
          <span className="badge-premium">PRO</span>
        </div>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{p.title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">{p.subtitle}</p>
      </header>

      <section className="card mb-6 overflow-hidden">
        <div className="border-b border-border px-4 py-2">
          <span className="label-caps">{p.performance}</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.totalPositions}</p>
            <p className="mt-0.5 font-mono text-[20px] font-bold">{summary.totalPicks}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">
              {fmt(p.openClosedFmt, { open: summary.openCount, closed: summary.closedCount })}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.avgRealized}</p>
            <p className={`mt-0.5 font-mono text-[20px] font-bold ${returnClass(summary.avgReturnPct)}`}>
              {fmtPct(summary.avgReturnPct)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">equal-weight</p>
          </div>
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.openUnrealized}</p>
            <p className={`mt-0.5 font-mono text-[20px] font-bold ${returnClass(summary.avgOpenUnrealizedPct)}`}>
              {fmtPct(summary.avgOpenUnrealizedPct)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">{p.liveEstimate}</p>
          </div>
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.winRate}</p>
            <p className="mt-0.5 font-mono text-[20px] font-bold">{fmtPct(summary.winRatePct)}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">closed positions</p>
          </div>
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.bestClose}</p>
            {summary.bestClosed ? (
              <>
                <p className={`mt-0.5 font-mono text-[18px] font-bold ${returnClass(summary.bestClosed.pct)}`}>
                  {fmtPct(summary.bestClosed.pct)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted">{summary.bestClosed.ticker}</p>
              </>
            ) : (
              <p className="mt-0.5 font-mono text-[16px] text-muted-soft">—</p>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="label-caps text-[10px]">{p.worstClose}</p>
            {summary.worstClosed ? (
              <>
                <p className={`mt-0.5 font-mono text-[18px] font-bold ${returnClass(summary.worstClosed.pct)}`}>
                  {fmtPct(summary.worstClosed.pct)}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted">{summary.worstClosed.ticker}</p>
              </>
            ) : (
              <p className="mt-0.5 font-mono text-[16px] text-muted-soft">—</p>
            )}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{fmt(p.openTitleFmt, { n: open.length })}</h2>
          <p className="text-[11px] text-muted">{p.priceSource}</p>
        </div>
        {open.length === 0 ? (
          <p className="rounded border border-border px-4 py-8 text-center text-[13px] text-muted">{p.noOpen}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((pick) => (
              <OpenCard key={pick.id} pick={pick} perf={perfMap.get(pick.id)!} p={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{fmt(p.closedTitleFmt, { n: closed.length })}</h2>
        </div>
        {closed.length === 0 ? (
          <p className="rounded border border-border px-4 py-8 text-center text-[13px] text-muted">{p.noClosed}</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_90px_90px_90px_90px] gap-3 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <span>{p.colSymbol}</span>
              <span>{p.colTitle}</span>
              <span className="text-right">{p.colEntry}</span>
              <span className="text-right">{p.colClose}</span>
              <span className="text-right">{p.colHeld}</span>
              <span className="text-right">{p.colReturn}</span>
            </div>
            <div className="divide-y divide-border">
              {closed.map((pick) => (
                <ClosedRow key={pick.id} pick={pick} perf={perfMap.get(pick.id)!} p={p} />
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="mt-8 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-soft">
        {p.disclaimer}
      </p>
    </div>
  );
}
