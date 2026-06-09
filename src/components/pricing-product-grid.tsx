"use client";

import { useMemo, useState } from "react";
import { PricingCheckout } from "@/components/pricing-checkout";
import {
  formatYuan,
  plansForProduct,
  PRODUCT_COPY,
  PRODUCT_LINES,
  type ProductLine,
} from "@/lib/payments/plans";

export function PricingProductGrid({
  loggedIn,
  userEmail,
  initialProduct = "bundle",
  primaryChannel = "gumroad",
}: {
  loggedIn: boolean;
  userEmail?: string | null;
  initialProduct?: ProductLine;
  primaryChannel?: "stripe" | "gumroad";
}) {
  const [product, setProduct] = useState<ProductLine>(initialProduct);
  const plans = useMemo(() => plansForProduct(product), [product]);
  const copy = PRODUCT_COPY[product];

  return (
    <div>
      <div className="grid gap-2 md:grid-cols-3">
        {PRODUCT_LINES.map((p) => {
          const active = p === product;
          const sample = plansForProduct(p)[0];
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProduct(p)}
              className={`card p-4 text-left transition ${
                active ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-strong">
                {PRODUCT_COPY[p].title}
              </p>
              <p className="mt-1 text-[12px] text-muted">{PRODUCT_COPY[p].subtitle}</p>
              <p className="mt-2 font-mono text-[18px] font-bold">
                从 {formatYuan(sample.amount)}
                <span className="text-[11px] font-normal text-muted">/月起</span>
              </p>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-1 text-[12px] text-foreground-soft md:grid-cols-3">
        {copy.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-accent-strong">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <PricingCheckout
          plans={plans}
          loggedIn={loggedIn}
          userEmail={userEmail}
          primaryChannel={primaryChannel}
          showAltChannels={false}
        />
      </div>
    </div>
  );
}
