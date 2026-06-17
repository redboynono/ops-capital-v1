"use client";

import Link from "next/link";
import type { ProductLine } from "@/lib/payments/plans";
import { useDict } from "@/components/locale-provider";

export function ProductPaywallCard({
  product,
  loggedIn,
  compact,
}: {
  product: ProductLine;
  loggedIn: boolean;
  compact?: boolean;
}) {
  const { products } = useDict().paywall;
  const c = products[product];
  const loginLabel = useDict().paywall.login;

  return (
    <div
      className={`rounded-lg border border-accent/40 bg-accent-soft/40 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
        {c.title}
      </p>
      <p className={`mt-1 text-foreground ${compact ? "text-[12px]" : "text-[14px]"}`}>
        {c.body}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/pricing?product=${product}`}
          className="btn-primary px-4 py-2 text-[12px]"
        >
          {c.cta}
        </Link>
        {!loggedIn ? (
          <Link href={`/login?redirect=/pricing?product=${product}`} className="btn-outline px-4 py-2 text-[12px]">
            {loginLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
