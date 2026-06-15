import Link from "next/link";

import {
  getListPerformance,
  listAllConvictionLists,
  type ListPerformance,
} from "@/lib/conviction";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function pnlClass(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "text-muted";
  if (v > 0) return "text-[color:var(--success)]";
  if (v < 0) return "text-[color:var(--danger)]";
  return "text-foreground";
}

export default async function ConvictionIndexPage() {
  const locale = await getLocale();
  const c = getDictionary(locale).conviction;
  const lists = await listAllConvictionLists();
  const perfs = await Promise.all(lists.map((l) => getListPerformance(l.id)));
  const enriched: ListPerformance[] = perfs.filter((p): p is ListPerformance => p != null);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{c.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{c.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{c.subtitle}</p>
      </header>

      {enriched.length === 0 ? (
        <div className="card px-4 py-12 text-center text-[13px] text-muted">
          <p className="mb-1 text-[16px] font-semibold text-foreground">{c.emptyTitle}</p>
          <p>{c.emptyBody}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {enriched.map((perf) => (
            <ListCard key={perf.list.id} perf={perf} picksFmt={c.picksFmt} />
          ))}
        </div>
      )}

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        {c.disclaimer}
      </p>
    </div>
  );
}

function ListCard({ perf, picksFmt }: { perf: ListPerformance; picksFmt: string }) {
  const { list, picks, total_return_pct, best, worst, benchmark, alpha_pct } = perf;
  const active = list.is_active === 1 && !list.end_date;
  return (
    <Link href={`/conviction/${list.id}`} className="card row-hover block p-4">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="label-caps text-[10px]">
            {list.publish_date} · {fmt(picksFmt, { n: picks.length })}
            {active ? <span className="ml-2 text-accent-strong">● ACTIVE</span> : null}
          </p>
          <h2 className="mt-0.5 text-[16px] font-bold text-foreground">{list.period_label}</h2>
        </div>
        <span className={`font-mono text-[18px] font-bold ${pnlClass(total_return_pct)}`}>
          {fmtPct(total_return_pct)}
        </span>
      </header>
      <p className="line-clamp-2 text-[12px] text-muted">{list.thesis ?? ""}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="label-caps text-[9px]">Best</p>
          <p className={`font-mono font-bold ${pnlClass(best?.return_pct ?? null)}`}>
            {best ? `${best.symbol} ${fmtPct(best.return_pct)}` : "—"}
          </p>
        </div>
        <div>
          <p className="label-caps text-[9px]">Worst</p>
          <p className={`font-mono font-bold ${pnlClass(worst?.return_pct ?? null)}`}>
            {worst ? `${worst.symbol} ${fmtPct(worst.return_pct)}` : "—"}
          </p>
        </div>
        <div>
          <p className="label-caps text-[9px]">Alpha</p>
          <p className={`font-mono font-bold ${pnlClass(alpha_pct)}`}>
            {benchmark ? fmtPct(alpha_pct) : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
