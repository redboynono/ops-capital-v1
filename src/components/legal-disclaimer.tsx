import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";

type Variant = "inline" | "block" | "compact";

export async function LegalDisclaimer({ variant = "block" }: { variant?: Variant }) {
  const locale = await getLocale();
  const d = getDictionary(locale).compliance;

  if (variant === "compact") {
    return (
      <p className="text-[10px] leading-relaxed text-muted">
        {d.compact}{" "}
        <Link href="/terms" className="text-accent-strong hover:underline">
          {d.termsLink}
        </Link>
      </p>
    );
  }

  if (variant === "inline") {
    return <span className="text-[11px] text-muted">{d.inline}</span>;
  }

  return (
    <aside className="rounded border border-border/80 bg-surface-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
      <p className="font-semibold text-foreground-soft">{d.title}</p>
      <p className="mt-1">{d.body}</p>
      <p className="mt-1">
        <Link href="/terms" className="text-accent-strong hover:underline">
          {d.termsLink}
        </Link>
        {" · "}
        <Link href="/track-record" className="text-accent-strong hover:underline">
          {d.trackRecordLink}
        </Link>
      </p>
    </aside>
  );
}
