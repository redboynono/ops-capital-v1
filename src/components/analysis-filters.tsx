import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locale-types";

type Props = {
  sectors: string[];
  current: { symbol?: string; sector?: string; period?: string };
  locale: Locale;
};

export function AnalysisFilters({ sectors, current, locale }: Props) {
  const f = getDictionary(locale).analysis.filters;
  const all = getDictionary(locale).common.all;
  const base = "/analysis";

  const PERIODS = [
    { value: "", label: f.allTime },
    { value: "week", label: f.week },
    { value: "month", label: f.month },
  ] as const;

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
        <span className="label-caps text-muted">{f.time}</span>
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
          <span className="label-caps text-muted">{f.sector}</span>
          <Link
            href={href({ sector: undefined })}
            className={
              !current.sector
                ? "rounded border border-accent px-2 py-0.5 font-semibold text-accent-strong"
                : "rounded border border-border px-2 py-0.5 text-muted hover:border-accent"
            }
          >
            {all}
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
