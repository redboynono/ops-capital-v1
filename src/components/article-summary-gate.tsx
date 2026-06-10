import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Locale } from "@/lib/i18n/locale-types";
import type { TocItem } from "@/lib/markdown-toc";
import { plansForProduct, type ProductLine } from "@/lib/payments/plans";

const SOCIAL_PROOF_MIN = 20;

export function ArticleSummaryGate({
  excerpt,
  teaser,
  sections,
  product = "research",
  readers = 0,
  locale = "zh",
}: {
  excerpt: string;
  teaser?: string | null;
  sections: TocItem[];
  product?: ProductLine;
  readers?: number;
  locale?: Locale;
}) {
  const s = getDictionary(locale).analysis.summary;
  const topSections = sections.filter((sec) => sec.level === 2);
  const lockedCount = topSections.length || sections.length;
  const pricingHref = `/pricing?product=${product}`;

  const monthly = plansForProduct(product)[0];
  const monthlyPrice = monthly ? `$${(monthly.amount / 100).toFixed(2)}` : null;
  const showSocialProof = readers >= SOCIAL_PROOF_MIN;

  return (
    <section className="ops-summary not-prose">
      <div className="ops-summary-head">
        <span className="ops-summary-badge">{s.badge}</span>
        <span className="ops-summary-tag">{s.tag}</span>
      </div>

      {excerpt ? <p className="ops-summary-lede">{excerpt}</p> : null}
      {teaser ? <p className="ops-summary-teaser">{teaser}…</p> : null}

      {lockedCount > 0 ? (
        <div className="ops-summary-locked">
          <p className="ops-summary-locked-title">
            {fmt(s.lockedTitleFmt, { n: lockedCount })}
          </p>
          {topSections.length > 0 ? (
            <ul>
              {topSections.map((sec) => (
                <li key={sec.id}>
                  <Link href={pricingHref} className="ops-summary-locked-link">
                    {sec.text}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="ops-summary-cta-row">
            <Link href={pricingHref} className="ops-summary-cta">
              {s.unlock}
              {monthlyPrice ? (
                <span className="ops-summary-cta-price">{monthlyPrice}{s.perMonth}</span>
              ) : null}
            </Link>
            {showSocialProof ? (
              <span className="ops-summary-social">
                {fmt(s.socialProofFmt, { n: readers.toLocaleString("en-US") })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
