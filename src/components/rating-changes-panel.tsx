import Link from "next/link";
import { getCachedRatingChanges } from "@/lib/cached-data";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export async function RatingChangesPanel({ limit = 8, sinceHours = 72 }: { limit?: number; sinceHours?: number }) {
  const locale = await getLocale();
  const p = getDictionary(locale).panels;
  const changes = await getCachedRatingChanges(sinceHours, limit);

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{p.ratingChangesTitle}</h2>
          <p className="text-[11px] text-muted">{fmt(p.ratingChangesSubFmt, { hours: sinceHours })}</p>
        </div>
        <Link href="/rating-changes" className="text-[12px] font-semibold text-accent-strong hover:underline">
          {p.ratingChangesViewAll}
        </Link>
      </header>
      <div className="px-4 py-2">
        {changes.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-muted">{p.ratingChangesEmpty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {changes.map((c, i) => (
              <li key={`${c.symbol}-${c.field}-${i}`} className="py-2 text-[12px]">
                <Link href={`/t/${c.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                  {c.symbol}
                </Link>
                <span className="ml-2 text-muted">{c.label}</span>
                <span className="ml-1 text-foreground-soft">
                  {c.from_value} → <strong className="text-accent-strong">{c.to_value}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
