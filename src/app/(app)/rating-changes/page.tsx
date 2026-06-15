import Link from "next/link";
import { redirect } from "next/navigation";
import { getCachedRatingChanges } from "@/lib/cached-data";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

export default async function RatingChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/rating-changes");

  const locale = await getLocale();
  const r = getDictionary(locale).ratingChangesPage;
  const sp = await searchParams;
  const hours = Number(sp.hours ?? 72);
  const since = Number.isFinite(hours) ? hours : 72;
  const changes = await getCachedRatingChanges(since, 100);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{r.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{r.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {fmt(r.subtitleFmt, { hours: since, count: changes.length })}
        </p>
        <div className="mt-2 flex gap-2 text-[12px]">
          <Link href="/rating-changes?hours=24" className="text-muted hover:text-accent-strong">
            24h
          </Link>
          <Link href="/rating-changes?hours=72" className="text-muted hover:text-accent-strong">
            72h
          </Link>
          <Link href="/rating-changes?hours=168" className="text-muted hover:text-accent-strong">
            7d
          </Link>
        </div>
      </header>

      {changes.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          {r.empty}{" "}
          <Link href="/admin/ops" className="text-accent-strong hover:underline">
            {r.adminOps}
          </Link>{" "}
          {r.emptyEnd}
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {changes.map((c, i) => (
            <div key={`${c.symbol}-${c.field}-${i}`} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <div>
                <Link href={`/t/${c.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                  {c.symbol}
                </Link>
                <span className="ml-2 text-muted">{c.name}</span>
                <p className="mt-0.5 text-[12px] text-foreground-soft">
                  {c.label}：<span className="text-muted">{c.from_value}</span>
                  <span className="mx-1">→</span>
                  <span className="font-semibold text-accent-strong">{c.to_value}</span>
                </p>
              </div>
              <span className="font-mono text-[10px] text-muted">{c.captured_at.slice(0, 16)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
