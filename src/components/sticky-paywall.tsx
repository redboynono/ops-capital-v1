import Link from "next/link";
import { plansForProduct, type ProductLine } from "@/lib/payments/plans";

export function StickyPaywall({
  loggedIn,
  product = "research",
}: {
  loggedIn: boolean;
  product?: ProductLine;
  /** @deprecated 不再使用数字打码计数 */
  redactedCount?: number;
  variant?: "analysis" | "picks";
}) {
  const plans = plansForProduct(product);
  const monthly = plans[0];
  const yearly = plans[2];
  const headline =
    product === "options"
      ? "Option Alpha · 解锁可执行期权 Idea"
      : product === "bundle"
        ? "全站 Bundle · 解锁全部能力"
        : "Research Pro · 解锁可跟单的精选与研报";

  return (
    <div className="paywall-sticky">
      <div className="paywall-sticky-card">
        <div className="pw-headline">
          <h3>🔒 {headline}</h3>
          <p>订阅后立即生效 · 时长在到期日上叠加</p>
        </div>
        <div className="pw-prices">
          <Link href={`/pricing?product=${product}`} className="pw-price">
            月付 <strong>${(monthly.amount / 100).toFixed(2)}</strong>
          </Link>
          <Link href={`/pricing?product=${product}`} className="pw-price primary">
            年付 <strong>${(yearly.amount / 12 / 100).toFixed(0)}/月</strong>
          </Link>
          {!loggedIn ? (
            <Link href={`/login?redirect=/pricing?product=${product}`} className="pw-price">
              登录
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
