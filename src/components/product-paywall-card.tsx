import Link from "next/link";
import type { ProductLine } from "@/lib/payments/plans";

const COPY: Record<
  ProductLine,
  { title: string; body: string; cta: string }
> = {
  research: {
    title: "Research Pro",
    body: "解锁目标价、止损、完整投资逻辑与深度研报全文。",
    cta: "订阅 Research Pro",
  },
  options: {
    title: "Option Alpha",
    body: "解锁全标的扫描、Trade Idea、收益分析器与完整期权链。",
    cta: "订阅 Option Alpha",
  },
  bundle: {
    title: "全站 Bundle",
    body: "Research Pro + Option Alpha 一次开通。",
    cta: "订阅 Bundle",
  },
};

export function ProductPaywallCard({
  product,
  loggedIn,
  compact,
}: {
  product: ProductLine;
  loggedIn: boolean;
  compact?: boolean;
}) {
  const c = COPY[product];
  return (
    <div
      className={`rounded-lg border border-accent/40 bg-accent-soft/40 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
        {c.title}
      </p>
      <p className={`mt-1 text-foreground ${compact ? "text-[12px]" : "text-[14px]"}`}>
        {c.body}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/pricing?product=${product}`}
          className="btn-primary px-4 py-2 text-[12px]"
        >
          {c.cta}
        </Link>
        {!loggedIn ? (
          <Link href={`/login?redirect=/pricing?product=${product}`} className="btn-outline px-4 py-2 text-[12px]">
            登录
          </Link>
        ) : null}
      </div>
    </div>
  );
}
