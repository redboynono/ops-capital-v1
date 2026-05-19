import Link from "next/link";

const PERIODS = [
  { value: "", label: "全部时间" },
  { value: "week", label: "近一周" },
  { value: "month", label: "近一月" },
] as const;

type Props = {
  sectors: string[];
  current: { symbol?: string; sector?: string; period?: string };
};

export function AnalysisFilters({ sectors, current }: Props) {
  const base = "/analysis";

  function href(extra: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { ...current, ...extra };
    if (merged.symbol) p.set("symbol", merged.symbol);
    if (merged.sector) p.set("sector", merged.sector);
    if (merged.period) p.set("period", merged.period);
    const q = p.toString();
    return q ? `${base}?${q}` : base;
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="label-caps text-muted">时间</span>
        {PERIODS.map((t) => (
          <Link
            key={t.value || "all"}
            href={href({ period: t.value || undefined })}
            className={
              (current.period ?? "") === t.value
                ? "rounded border border-accent bg-accent-soft px-2 py-0.5 font-semibold text-accent-strong"
                : "rounded border border-border px-2 py-0.5 text-muted hover:border-accent"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>
      {sectors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="label-caps text-muted">行业</span>
          <Link
            href={href({ sector: undefined })}
            className={
              !current.sector
                ? "rounded border border-accent px-2 py-0.5 font-semibold text-accent-strong"
                : "rounded border border-border px-2 py-0.5 text-muted hover:border-accent"
            }
          >
            全部
          </Link>
          {sectors.map((s) => (
            <Link
              key={s}
              href={href({ sector: s })}
              className={
                current.sector === s
                  ? "rounded border border-accent px-2 py-0.5 font-semibold text-accent-strong"
                  : "rounded border border-border px-2 py-0.5 text-muted hover:border-accent"
              }
            >
              {s}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
