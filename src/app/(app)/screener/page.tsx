import Link from "next/link";
import { listScreenerRows } from "@/lib/screener";
import { ScreenerBrowser } from "@/components/screener-browser";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  const locale = await getLocale();
  const s = getDictionary(locale).screener;
  const rows = await listScreenerRows();
  const ratedCount = rows.filter((r) => r.quant_score != null).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{s.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{s.title}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {s.subtitle}
          {ratedCount > 0 ? <> {fmt(s.ratedFmt, { n: ratedCount })}</> : null}
        </p>
      </header>

      <ScreenerBrowser rows={rows} />
    </div>
  );
}
