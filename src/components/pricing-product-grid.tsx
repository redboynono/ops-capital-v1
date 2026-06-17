"use client";

import { useMemo, useState } from "react";
import { useDict } from "@/components/locale-provider";
import { PricingCheckout } from "@/components/pricing-checkout";
import {
  formatYuan,
  plansForProduct,
  PRODUCT_LINES,
  type ProductLine,
} from "@/lib/payments/plans";

export function PricingProductGrid({
  loggedIn,
  userEmail,
  initialProduct = "bundle",
  trialEligible = false,
  trialDays = 0,
}: {
  loggedIn: boolean;
  userEmail?: string | null;
  initialProduct?: ProductLine;
  trialEligible?: boolean;
  trialDays?: number;
}) {
  const dict = useDict();
  const p = dict.pricing;
  const [product, setProduct] = useState<ProductLine>(initialProduct);
  const plans = useMemo(() => plansForProduct(product), [product]);
  const copy = p.products[product];

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCT_LINES.map((line) => {
          const active = line === product;
          const sample = plansForProduct(line)[0];
          const lineCopy = p.products[line];
          return (
            <button
              key={line}
              type="button"
              onClick={() => setProduct(line)}
              className={`card p-4 text-left transition ${
                active ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-strong">
                {lineCopy.title}
              </p>
              <p className="mt-1 text-[12px] text-muted">{lineCopy.subtitle}</p>
              <p className="mt-2 font-mono text-[18px] font-bold">
                {p.fromPrefix} {formatYuan(sample.amount)}
                <span className="text-[11px] font-normal text-muted">{p.perMonth}</span>
              </p>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-1 text-[12px] text-foreground-soft md:grid-cols-2 lg:grid-cols-4">
        {copy.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-accent">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <PricingCheckout
        plans={plans}
        loggedIn={loggedIn}
        userEmail={userEmail}
        showAltChannels={false}
        trialEligible={trialEligible && product !== "brief"}
        trialDays={trialDays}
      />
    </div>
  );
}
