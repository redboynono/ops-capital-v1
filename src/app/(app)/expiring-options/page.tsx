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
import { getSessionUser } from "@/lib/auth";

export const metadata = {
  title: OPTION_ALPHA.pageTitle,
  description: OPTION_ALPHA.description,
};

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

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{OPTION_ALPHA.labelCaps}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{OPTION_ALPHA.name}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          {OPTION_ALPHA.description}。以<strong className="text-foreground-soft">表格 + 操作提示</strong>
          直接给出要跟的合约（标的、到期、行权价、C/P），默认本周五/下周五到期。
        </p>
        <p className="mt-2 text-[11px] text-muted-soft">
          扫描标的：{ZERO_DTE_WATCHLIST.join(" · ")}（亦可下方输入任意美股）
        </p>
        <div className="mt-3">
          <Suspense fallback={<p className="text-[12px] text-muted">加载到期日…</p>}>
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
        <h2 className="text-[15px] font-bold text-foreground">按标的筛选</h2>
        <p className="mt-1 text-[12px] text-muted">
          输入代码后只显示该标的在 {expiry.label}（{expiry.expirationDate}）的提示表。
        </p>
        <div className="mt-3">
          <ExpiringOptionsSymbolForm initialSymbol={querySymbol} week={expiry.week} />
        </div>
      </section>

      {querySymbol ? (
        <OptionTradeIdeasPanel
          symbol={querySymbol}
          expirationDate={expiry.expirationDate}
          expiryLabel={expiry.label}
          week={expiry.week}
        />
      ) : null}

      <div className="mb-5">
        <ExpiringOptionsDirectSignals
          expirationDate={expiry.expirationDate}
          expiryLabel={expiry.label}
          symbol={querySymbol || undefined}
        />
      </div>

      {querySymbol ? null : (
        <details className="mb-5 group" open>
          <summary className="cursor-pointer text-[13px] font-semibold text-accent-strong hover:underline">
            展开：AI 文字策略与多标的成交雷达
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
          ← 返回 Alpha 首页
        </Link>
      </p>
    </div>
  );
}
