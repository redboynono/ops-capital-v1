import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { PLAN_IDS, PLANS } from "@/lib/payments/plans";
import { isMockMode } from "@/lib/payments/gateways";
import { PricingCheckout } from "@/components/pricing-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "订阅方案 · Ops Alpha" };

const benefits = [
  "完整 Premium 分析（含估值模型）",
  "每月 OPS Picks 精选荐股（含目标价、止损与退出纪律）",
  "每日 2-3 篇 AI 机构级深度研报",
  "全部标的的分析/快讯聚合页",
  "自选股桌面 + 收藏 + 阅读历史",
  "免责合规：中文母语内容",
];

export default async function PricingPage() {
  const user = await getSessionUser();
  const mock = isMockMode();
  const plans = PLAN_IDS.map((id) => PLANS[id]);

  const subscribed =
    user?.subscriptionStatus === "active" &&
    (!user.subscriptionEndDate || new Date(user.subscriptionEndDate) > new Date());

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8 md:px-6">
      <header className="mb-5 border-b border-border pb-3">
        <span className="label-caps">Pricing</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">订阅 Ops Alpha Premium</h1>
        <p className="mt-1 text-[13px] text-muted">
          预付费买断制 · 到期前续费自动叠加 · 支持支付宝 / 微信支付
        </p>
      </header>

      {subscribed ? (
        <div className="card mb-5 border-[color:var(--success)] p-4">
          <p className="label-caps text-[color:var(--success)]">当前状态</p>
          <p className="mt-1 text-[14px]">
            你已是 Premium 会员，到期时间：
            <span className="font-mono ml-1 font-semibold">
              {user!.subscriptionEndDate ? new Date(user!.subscriptionEndDate).toLocaleDateString("zh-CN") : "永久"}
            </span>
          </p>
          <p className="mt-1 text-[12px] text-muted">续费后时长将在到期时间上叠加，不会丢失剩余天数。</p>
        </div>
      ) : null}

      {mock ? (
        <p className="mb-4 rounded border border-dashed border-accent/60 bg-accent-soft px-3 py-2 text-[11px] text-accent-strong">
          当前为 <code className="mono">PAYMENT_MODE=mock</code> 环境。点击支付按钮后会弹出测试流程，不扣实际款项。
        </p>
      ) : null}

      <section>
        <PricingCheckout plans={plans} loggedIn={Boolean(user)} />
      </section>

      <section className="card mt-6 p-5">
        <p className="label-caps">Premium 权益</p>
        <ul className="mt-2 grid gap-2 text-[13px] md:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-0.5 text-accent-strong">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 text-[12px] leading-relaxed text-muted">
        <h3 className="label-caps text-[11px]">常见问题</h3>
        <dl className="mt-2 space-y-3">
          <div>
            <dt className="font-semibold text-foreground-soft">Q: 购买后什么时候开始计算会员时长？</dt>
            <dd className="mt-0.5">支付成功后立即生效。如果你当前已是会员，新时长会在现有到期日之上叠加，不会丢失天数。</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground-soft">Q: 可以开发票吗？</dt>
            <dd className="mt-0.5">年度会员可申请增值税普通发票，请在支付成功后联系 <Link href="/contact" className="text-accent-strong">support</Link>。</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground-soft">Q: 退款政策？</dt>
            <dd className="mt-0.5">首次购买 7 天内未使用 Premium 功能可全额退款，支付宝 / 微信原路返回。</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
