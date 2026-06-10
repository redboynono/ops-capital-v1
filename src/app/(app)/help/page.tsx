import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.helpTitle };
}

export default async function HelpPage() {
  const locale = await getLocale();
  const h = getDictionary(locale).help;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Help</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{h.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{h.subtitle}</p>
      </header>

      <section className="card mb-5 border-[color:var(--accent)]/30">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">{h.pwaLabel}</p>
          <p className="mt-1 text-[13px] text-foreground-soft">{h.pwaTitle}</p>
        </header>
        <div className="space-y-2 px-4 py-3 text-[13px] leading-relaxed text-muted">
          <p>{h.pwaP1}</p>
          <p className="text-[12px]">{h.pwaP2}</p>
        </div>
      </section>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">{h.navTitle}</p>
          <p className="mt-1 text-[11px] text-muted">{h.navHint}</p>
        </header>
        <div className="divide-y divide-border">
          {h.pages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="row-hover flex items-center gap-4 px-4 py-2.5 text-[13px]"
            >
              <span className="w-16 font-mono font-bold text-accent-strong">{p.label}</span>
              <span className="flex-1 text-foreground-soft">{p.desc}</span>
              <span className="font-mono text-[11px] text-muted-soft">{p.href}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">{h.ratingTitle}</p>
        </header>
        <div className="divide-y divide-border">
          {h.ratingNotes.map((r) => (
            <div key={r.k} className="flex items-start gap-4 px-4 py-2.5 text-[13px]">
              <span className="w-24 font-mono font-bold text-accent-strong">{r.k}</span>
              <span className="flex-1 text-foreground-soft">{r.v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">{h.gradesTitle}</p>
          <p className="mt-1 text-[11px] text-muted">{h.gradesHint}</p>
        </header>
        <div className="divide-y divide-border">
          {h.gradeMeaning.map((g) => (
            <div key={g.g} className="flex items-center gap-4 px-4 py-2.5 text-[13px]">
              <span
                className="inline-flex h-7 w-24 items-center justify-center rounded-sm font-mono text-[12px] font-bold text-white"
                style={{ background: g.color }}
              >
                {g.g}
              </span>
              <span className="flex-1 text-foreground-soft">{g.meaning}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-5 p-4">
        <p className="label-caps">{h.disclaimerTitle}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{h.disclaimerBody}</p>
      </section>

      <p className="text-center text-[12px] text-muted">
        {h.footer}{" "}
        <a href="mailto:support@opscapital.com" className="font-mono text-accent-strong hover:underline">
          support@opscapital.com
        </a>
      </p>
    </div>
  );
}
