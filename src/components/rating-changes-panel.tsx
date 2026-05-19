import Link from "next/link";
import { listRecentRatingChanges } from "@/lib/rating-changes";

export async function RatingChangesPanel({ limit = 8, sinceHours = 72 }: { limit?: number; sinceHours?: number }) {
  const changes = await listRecentRatingChanges({ sinceHours, limit });

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">评级变动</h2>
          <p className="text-[11px] text-muted">近 {sinceHours}h · OPS / Quant / 因子</p>
        </div>
        <Link href="/rating-changes" className="text-[12px] font-semibold text-accent-strong hover:underline">
          全部 →
        </Link>
      </header>
      <div className="px-4 py-2">
        {changes.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-muted">近期无显著变动</p>
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
