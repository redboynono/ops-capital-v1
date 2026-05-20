import { ExpiringOptionsPickCard } from "@/components/expiring-options-pick-card";
import { buildSymbolExpiringOptionsPlaybook } from "@/lib/expiring-options-playbook";
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
  const result = await buildSymbolExpiringOptionsPlaybook(symbol, expirationDate, expiryLabel);

  if (result.status === "error") {
    return (
      <section className="card border-dashed p-4">
        <p className="text-[13px] font-semibold text-foreground">
          {result.symbol ? (
            <span className="font-mono text-accent-strong">{result.symbol}</span>
          ) : null}
          {result.symbol ? " · " : null}
          无法生成策略
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{result.message}</p>
      </section>
    );
  }

  const { summary, pick, flowNote, expirationDate: exp } = result;

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border bg-surface-muted px-4 py-3">
        <span className="label-caps">{OPTION_ALPHA.name} · {expiryLabel}</span>
        <h2 className="mt-0.5 text-[17px] font-bold text-foreground">
          <span className="font-mono text-accent-strong">{result.symbol}</span> AI 跟单策略
        </h2>
        <p className="mt-1 text-[12px] text-muted">
          到期 {exp}（{expiryLabel}）· {flowNote}
        </p>
      </header>

      <div className="px-4 py-4">
        <ExpiringOptionsPickCard leg={pick} badge={`${result.symbol} · ${expiryLabel}`} />
      </div>

      <div className="border-t border-border px-4 py-3 text-[12px] text-muted-soft">
        <p>
          总成交 {summary.totalVolume.toLocaleString()} 张 · 方向判定：
          {summary.bias === "bullish"
            ? "偏多"
            : summary.bias === "bearish"
              ? "偏空"
              : "震荡/不明"}
        </p>
      </div>
    </section>
  );
}
