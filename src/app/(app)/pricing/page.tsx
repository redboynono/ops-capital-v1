import Link from "next/link";
import { PricingProductGrid } from "@/components/pricing-product-grid";
import { getSessionUser } from "@/lib/auth";
import { hasOptionAlphaAccess, hasResearchAccess } from "@/lib/entitlements";
import { getDictionary, getLocale } from "@/lib/i18n";
import { isMockMode } from "@/lib/payments/gateways";
import { TRIAL_DAYS, type ProductLine } from "@/lib/payments/plans";
import { hasUsedTrial } from "@/lib/payments/subscriptions";
import { isSubscriptionActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return { title: t.meta.pricingTitle };
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const p = t.pricing;
  const user = await getSessionUser();
  const mock = isMockMode();
  const initialProduct: ProductLine =
    sp.product === "research" || sp.product === "options" || sp.product === "bundle"
      ? sp.product
      : "bundle";

  const active = user
    ? isSubscriptionActive({
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
      })
    : false;

  const trialEligible = user ? !(await hasUsedTrial(user.id)) : true;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-6">
      <header className="mb-5 border-b border-border pb-3">
        <span className="label-caps">Pricing</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{p.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{p.subtitle}</p>
      </header>

      {active && user ? (
        <div className="card mb-5 border-[color:var(--success)] p-4">
          <p className="label-caps text-[color:var(--success)]">{p.currentEntitlement}</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            <li>
              Research Pro：{hasResearchAccess(user) ? p.researchOn : p.researchOff}
            </li>
            <li>
              Option Alpha：{hasOptionAlphaAccess(user) ? p.optionOn : p.optionOff}
            </li>
            <li className="text-muted">
              {p.expires}
              <span className="ml-1 font-mono font-semibold text-foreground">
                {user.subscriptionEndDate
                  ? new Date(user.subscriptionEndDate).toLocaleDateString(dateLocale)
                  : "—"}
              </span>
              {p.renewNote}
            </li>
          </ul>
        </div>
      ) : null}

      {mock ? (
        <p className="mb-4 rounded border border-dashed border-accent/60 bg-accent-soft px-3 py-2 text-[11px] text-accent-strong">
          {p.mockNote}
        </p>
      ) : null}

      <PricingProductGrid
        loggedIn={Boolean(user)}
        userEmail={user?.email ?? null}
        initialProduct={initialProduct}
        trialEligible={trialEligible}
        trialDays={TRIAL_DAYS}
      />

      <section className="card mt-6 p-5">
        <p className="label-caps">{p.compareTitle}</p>
        <div className="mt-3 grid gap-3 text-[12px] md:grid-cols-3">
          {(["research", "options", "bundle"] as const).map((key) => (
            <div key={key} className="rounded border border-border/80 p-3">
              <p className="font-bold text-foreground">{p.products[key].title}</p>
              <ul className="mt-2 space-y-1 text-muted">
                {p.products[key].bullets.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 text-[12px] leading-relaxed text-muted">
        <h3 className="label-caps text-[11px]">{p.paymentTitle}</h3>
        {p.paymentBullets.map((line) => (
          <p key={line} className="mt-2">
            {line}
          </p>
        ))}
        <p className="mt-2">
          <Link href="/help" className="text-accent-strong hover:underline">
            {p.helpCenter}
          </Link>
          {" · "}
          <Link href="/contact" className="text-accent-strong hover:underline">
            {p.contactSupport}
          </Link>
        </p>
      </section>
    </div>
  );
}
