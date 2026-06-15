import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ExpiringOptionsChainTable } from "@/components/expiring-options-chain";
import { OptionTradeIdeasPanel } from "@/components/option-trade-ideas-panel";
import { ExpiringOptionsDirectSignals } from "@/components/expiring-options-direct-signals";
import { ExpiringOptionsExpiryPicker } from "@/components/expiring-options-expiry-picker";
import { ExpiringOptionsPlaybook } from "@/components/expiring-options-playbook";
import { ExpiringOptionsRadar } from "@/components/expiring-options-radar";
import { ExpiringOptionsSymbolForm } from "@/components/expiring-options-symbol-form";
import { normalizeUsTickerInput, ZERO_DTE_WATCHLIST } from "@/lib/expiring-options";
import { buildExpiringOptionsQuery, resolveExpirySelection } from "@/lib/options-expiry";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";
import { ProductPaywallCard } from "@/components/product-paywall-card";
import { getSessionUser } from "@/lib/auth";
import {
  hasOptionAlphaAccess,
  OPTION_ALPHA_FREE_PREVIEW_SYMBOL,
} from "@/lib/entitlements";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";

export const dynamic = "force-dynamic";

export default async function ExpiringOptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; week?: string; exp?: string }>;
}) {
  const sp = await searchParams;
  const querySymbol = sp.symbol ? normalizeUsTickerInput(sp.symbol) : "";
  const expiry = resolveExpirySelection(sp);
  const loginRedirect = `/expiring-options${buildExpiringOptionsQuery({
    week: expiry.week,
    symbol: querySymbol || undefined,
  })}`;

  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(loginRedirect)}`);

  const locale = await getLocale();
  const o = getDictionary(locale).optionsPage;

  const optionPro = hasOptionAlphaAccess(user);
  const previewOnly =
    !optionPro &&
    querySymbol &&
    querySymbol !== OPTION_ALPHA_FREE_PREVIEW_SYMBOL;
  const symbolForData = optionPro
    ? querySymbol
    : querySymbol || OPTION_ALPHA_FREE_PREVIEW_SYMBOL;
  const effectiveSymbol =
    previewOnly ? OPTION_ALPHA_FREE_PREVIEW_SYMBOL : symbolForData;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{o.labelCaps}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{o.title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          {o.description} {o.intro}
        </p>
        <p className="mt-2 text-[11px] text-muted-soft">
          {fmt(o.scanFmt, { list: ZERO_DTE_WATCHLIST.join(" · ") })}
        </p>
        <div className="mt-3">
          <Suspense fallback={<p className="text-[12px] text-muted">{o.loadingExpiry}</p>}>
            <ExpiringOptionsExpiryPicker
              week={expiry.week}
              thisFriday={expiry.thisFriday}
              nextFriday={expiry.nextFriday}
              symbol={querySymbol}
            />
          </Suspense>
        </div>
      </header>

      <section className="card mb-5 p-4">
        <h2 className="text-[15px] font-bold text-foreground">{o.filterBySymbol}</h2>
        <p className="mt-1 text-[12px] text-muted">
          {fmt(o.filterSubFmt, { label: expiry.label, date: expiry.expirationDate })}
        </p>
        <div className="mt-3">
          <ExpiringOptionsSymbolForm initialSymbol={querySymbol} week={expiry.week} />
        </div>
      </section>

      {previewOnly ? (
        <div className="mb-5">
          <ProductPaywallCard product="options" loggedIn compact />
          <p className="mt-2 text-[12px] text-muted">
            {fmt(o.previewOnlyFmt, { symbol: OPTION_ALPHA_FREE_PREVIEW_SYMBOL, query: querySymbol })}
          </p>
        </div>
      ) : null}

      {previewOnly ? null : (
        <div className="mb-5">
          <ExpiringOptionsDirectSignals
            expirationDate={expiry.expirationDate}
            expiryLabel={expiry.label}
            symbol={effectiveSymbol || undefined}
            rowLimit={optionPro ? undefined : 5}
          />
        </div>
      )}

      {effectiveSymbol && optionPro ? (
        <>
          <OptionTradeIdeasPanel
            symbol={effectiveSymbol}
            expirationDate={expiry.expirationDate}
            expiryLabel={expiry.label}
            week={expiry.week}
          />
          <div className="mb-5" id="option-chain">
            <ExpiringOptionsChainTable
              symbol={effectiveSymbol}
              expirationDate={expiry.expirationDate}
              expiryLabel={expiry.label}
            />
          </div>
        </>
      ) : !previewOnly ? (
        <div className="mb-5">
          <ProductPaywallCard product="options" loggedIn />
          {!optionPro ? (
            <p className="mt-2 text-[11px] text-muted">
              {fmt(o.freePreviewHint, { symbol: OPTION_ALPHA_FREE_PREVIEW_SYMBOL })}
            </p>
          ) : null}
        </div>
      ) : null}

      {querySymbol ? null : (
        <details className="mb-5 group" open>
          <summary className="cursor-pointer text-[13px] font-semibold text-accent-strong hover:underline">
            {o.expandAi}
          </summary>
          <div className="mt-4 space-y-5">
            <ExpiringOptionsPlaybook
              expirationDate={expiry.expirationDate}
              expiryLabel={expiry.label}
            />
            <ExpiringOptionsRadar
              limit={50}
              compact
              expirationDate={expiry.expirationDate}
              expiryLabel={expiry.label}
            />
          </div>
        </details>
      )}

      <p className="mt-5 text-[12px] text-muted-soft">
        <Link href="/alpha" className="text-accent-strong hover:underline">
          {o.backAlpha}
        </Link>
      </p>
    </div>
  );
}
