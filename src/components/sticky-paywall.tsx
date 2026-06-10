import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locale-types";
import { plansForProduct, type ProductLine } from "@/lib/payments/plans";

export function StickyPaywall({
  loggedIn,
  product = "research",
  locale = "zh",
}: {
  loggedIn: boolean;
  product?: ProductLine;
  locale?: Locale;
  redactedCount?: number;
  variant?: "analysis" | "picks";
}) {
  const p = getDictionary(locale).paywall;
  const plans = plansForProduct(product);
  const monthly = plans[0];
  const yearly = plans[2];
  const headline =
    product === "options" ? p.options : product === "bundle" ? p.bundle : p.research;

  return (
    <div className="paywall-sticky">
      <div className="paywall-sticky-card">
        <div className="pw-headline">
          <h3>🔒 {headline}</h3>
          <p>{p.note}</p>
        </div>
        <div className="pw-prices">
          <Link href={`/pricing?product=${product}`} className="pw-price">
            {p.monthly} <strong>${(monthly.amount / 100).toFixed(2)}</strong>
          </Link>
          <Link href={`/pricing?product=${product}`} className="pw-price primary">
            {p.yearly} <strong>${(yearly.amount / 12 / 100).toFixed(0)}/mo</strong>
          </Link>
          {!loggedIn ? (
            <Link href={`/login?redirect=/pricing?product=${product}`} className="pw-price">
              {p.login}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
