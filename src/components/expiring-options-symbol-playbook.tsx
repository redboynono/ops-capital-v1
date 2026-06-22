import { ExpiringOptionsPickCard } from "@/components/expiring-options-pick-card";
import { buildSymbolExpiringOptionsPlaybook } from "@/lib/expiring-options-playbook";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

export async function ExpiringOptionsSymbolPlaybook({
  symbol,
  expirationDate,
  expiryLabel,
}: {
  symbol: string;
  expirationDate: string;
  expiryLabel: string;
}) {
  const locale = await getLocale();
  const o = getDictionary(locale).optionsPage;
  const result = await buildSymbolExpiringOptionsPlaybook(
    symbol,
    o.playbook,
    expirationDate,
    expiryLabel,
  );

  if (result.status === "error") {
    return (
      <section className="card border-dashed p-4">
        <p className="text-[13px] font-semibold text-foreground">
          {result.symbol ? (
            <span className="font-mono text-accent-strong">{result.symbol}</span>
          ) : null}
          {result.symbol ? " · " : null}
          {o.symbolPlaybook.errorTitle}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{result.message}</p>
      </section>
    );
  }

  const { summary, pick, flowNote, expirationDate: exp } = result;
  const biasLabel =
    summary.bias === "bullish"
      ? o.symbolPlaybook.biasBullish
      : summary.bias === "bearish"
        ? o.symbolPlaybook.biasBearish
        : o.symbolPlaybook.biasNeutral;

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border bg-surface-muted px-4 py-3">
        <span className="label-caps">
          {OPTION_ALPHA.name} · {expiryLabel}
        </span>
        <h2 className="mt-0.5 text-[17px] font-bold text-foreground">
          {fmt(o.symbolPlaybook.titleFmt, { symbol: result.symbol })}
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          {fmt(o.symbolPlaybook.expiryFmt, { date: exp, label: expiryLabel, flow: flowNote })}
        </p>
      </header>

      <div className="px-4 py-4">
        <ExpiringOptionsPickCard
          leg={pick}
          badge={`${result.symbol} · ${expiryLabel}`}
          ui={o.pickCard}
        />
      </div>

      <div className="border-t border-border px-4 py-3 text-[12px] text-muted-soft">
        <p>
          {fmt(o.symbolPlaybook.summaryFmt, {
            vol: summary.totalVolume.toLocaleString(),
            bias: biasLabel,
          })}
        </p>
      </div>
    </section>
  );
}
