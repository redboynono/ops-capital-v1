import Link from "next/link";

export const metadata = { title: "订阅方案 · Ops Alpha" };

const benefits = [
  "完整 Premium 分析（含估值模型）",
  "每周宏观与科技备忘录",
  "全部标的的分析/快讯聚合页",
  "自选股桌面 + 收藏 + 阅读历史",
  "AI 作者署名 + 编辑精选",
  "免责合规：中文母语内容",
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8 md:px-6">
      <header className="mb-5 border-b border-border pb-3">
        <span className="label-caps">Pricing</span>
        <h1 className="mt-1 text-3xl font-bold text-foreground">订阅 Ops Alpha Premium</h1>
        <p className="mt-1 text-[13px] text-muted">
          免费阅读摘要与所有快讯 · Premium 解锁完整分析长文与估值模型
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="label-caps">月付方案</p>
          <h2 className="mt-2 font-[var(--font-brand-serif)] text-4xl font-bold text-foreground">
            ¥50<span className="ml-1 text-base text-muted">/ 月</span>
          </h2>
          <p className="mt-1 text-[12px] text-muted">灵活按月订阅，随时取消</p>
          <Link href="/login?tab=signup" className="btn-primary mt-4 inline-block px-4 py-1.5 text-[12px]">
            注册并订阅
          </Link>
        </div>
        <div className="card border-accent p-5" style={{ background: "var(--accent-soft)" }}>
          <p className="label-caps">年付方案 · 推荐</p>
          <h2 className="mt-2 font-[var(--font-brand-serif)] text-4xl font-bold text-foreground">
            ¥500<span className="ml-1 text-base text-muted">/ 年</span>
          </h2>
          <p className="mt-1 text-[12px] text-accent-strong">相当于 8 折 · 两个月免费</p>
          <Link href="/login?tab=signup" className="btn-primary mt-4 inline-block px-4 py-1.5 text-[12px]">
            注册并订阅
          </Link>
        </div>
      </section>

      <section className="card mt-5 p-5">
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

      <p className="mt-6 text-[11px] leading-relaxed text-muted-soft">
        说明：订阅流程与支付通道（Stripe / 微信 / 支付宝）将在 P2 接入。当前可先注册账号体验免费内容。
      </p>
    </div>
  );
}
