import { SubscribeButton } from "@/components/subscribe-button";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold">订阅方案</h1>
        <p className="mt-2 text-zinc-400">专业投研用户：摘要免费，深度研报付费解锁。</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <p className="text-sm text-zinc-400">Monthly</p>
            <p className="mt-2 text-3xl font-semibold">$50</p>
            <p className="mt-2 text-sm text-zinc-400">每月自动续费，可随时取消</p>
            <div className="mt-6">
              <SubscribeButton plan="monthly" />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6">
            <p className="text-sm text-emerald-300">Yearly · Best Value</p>
            <p className="mt-2 text-3xl font-semibold">$500</p>
            <p className="mt-2 text-sm text-zinc-300">年付节省约 16%，适合长期跟踪策略</p>
            <div className="mt-6">
              <SubscribeButton plan="yearly" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
