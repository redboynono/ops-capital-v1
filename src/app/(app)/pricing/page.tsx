import Link from "next/link";
import { PricingProductGrid } from "@/components/pricing-product-grid";
import { getSessionUser } from "@/lib/auth";
import { hasOptionAlphaAccess, hasResearchAccess } from "@/lib/entitlements";
import { isMockMode } from "@/lib/payments/gateways";
import { PRODUCT_COPY, TRIAL_DAYS, type ProductLine } from "@/lib/payments/plans";
import { hasUsedTrial } from "@/lib/payments/subscriptions";
import { isSubscriptionActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const metadata = { title: "订阅方案 · Ops Alpha" };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const sp = await searchParams;
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

  // 未登录访客按「可试用」展示（引流）；已登录则按其是否用过试用判定
  const trialEligible = user ? !(await hasUsedTrial(user.id)) : true;

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-8 md:px-6">
      <header className="mb-5 border-b border-border pb-3">
        <span className="label-caps">Pricing</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">选择你的 OPS Alpha 方案</h1>
        <p className="mt-1 text-[13px] text-muted">
          按能力订阅，不再用「全文打码」—— Research 跟单、Option Copilot 可分开买，也可 Bundle 一次全开。
        </p>
      </header>

      {active && user ? (
        <div className="card mb-5 border-[color:var(--success)] p-4">
          <p className="label-caps text-[color:var(--success)]">当前权益</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            <li>
              Research Pro：{hasResearchAccess(user) ? "✓ 已开通" : "— 未开通"}
            </li>
            <li>
              Option Alpha：{hasOptionAlphaAccess(user) ? "✓ 已开通" : "— 未开通"}
            </li>
            <li className="text-muted">
              会员到期：
              <span className="ml-1 font-mono font-semibold text-foreground">
                {user.subscriptionEndDate
                  ? new Date(user.subscriptionEndDate).toLocaleDateString("zh-CN")
                  : "—"}
              </span>
              （续费叠加剩余天数）
            </li>
          </ul>
        </div>
      ) : null}

      {mock ? (
        <p className="mb-4 rounded border border-dashed border-accent/60 bg-accent-soft px-3 py-2 text-[11px] text-accent-strong">
          当前为 <code className="mono">PAYMENT_MODE=mock</code>，支付为测试流程。
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
        <p className="label-caps">对比一览</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-[12px]">
          {(["research", "options", "bundle"] as const).map((p) => (
            <div key={p} className="rounded border border-border/80 p-3">
              <p className="font-bold text-foreground">{PRODUCT_COPY[p].title}</p>
              <ul className="mt-2 space-y-1 text-muted">
                {PRODUCT_COPY[p].bullets.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 text-[12px] leading-relaxed text-muted">
        <h3 className="label-caps text-[11px]">支付说明</h3>
        <p className="mt-2">
          由 Stripe Checkout 处理（银行卡 / Apple Pay 等）。付款成功后 Webhook 自动开通对应{" "}
          <code>plan_id</code> 权益。Research 与 Option Alpha 以订单产品线区分。
        </p>
        <p className="mt-2">
          <Link href="/help" className="text-accent-strong hover:underline">
            帮助中心
          </Link>
          {" · "}
          <Link href="/contact" className="text-accent-strong hover:underline">
            联系客服
          </Link>
        </p>
      </section>
    </div>
  );
}
