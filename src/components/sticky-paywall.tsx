import Link from "next/link";
import { PLANS } from "@/lib/payments/plans";

/**
 * Bottom sticky CTA bar shown to non-subscribers on premium articles.
 * Listing all three plans inline reduces the click distance from
 * "I want to read this" → "I bought it" to a single tap.
 */
export function StickyPaywall({
  loggedIn,
  redactedCount,
  variant = "analysis",
}: {
  loggedIn: boolean;
  redactedCount: number;
  variant?: "analysis" | "picks";
}) {
  const headline =
    variant === "picks"
      ? "OPS Picks · 解锁目标价 / 止损 / 完整逻辑"
      : "Premium 分析 · 解锁完整数据";
  const sub =
    redactedCount > 0
      ? `本文含 ${redactedCount} 处订阅独享数据 · 已对你打码`
      : "订阅后看到所有目标价、估值倍数、收益率";

  const monthly = PLANS.month;
  const yearly = PLANS.year;
  const dollarsOf = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const yearlyEquivMonthly = `$${(yearly.amount / 12 / 100).toFixed(2)}/月`;

  return (
    <div className="paywall-sticky">
      <div className="paywall-sticky-card">
        <div className="pw-headline">
          <h3>🔒 {headline}</h3>
          <p>{sub}</p>
        </div>
        <div className="pw-prices">
          <Link href="/pricing" className="pw-price">
            月付 <strong>{dollarsOf(monthly.amount)}</strong>
          </Link>
          <Link href="/pricing" className="pw-price primary">
            年付仅 <strong>{yearlyEquivMonthly}</strong>
          </Link>
          {!loggedIn ? (
            <Link href="/login?redirect=/pricing" className="pw-price">
              登录
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
